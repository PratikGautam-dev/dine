# db/repositories/menu_items.py
"""Food ordering plan, Sub-stage 2 of 4: menu item CRUD + the v1 "sold out
today" availability mechanism. Confirmed with the user: a plain
stock-integer decrement/reset (reusing the atomic conditional-UPDATE the
commerce reference doc establishes for stock protection), not a time-window/
kitchen-capacity concept -- that's flagged as future scope, no existing
precedent to build on yet.

id follows tables.py's own opaque "h{hospital_id}_{uuid8}" TEXT id
convention (create_table()/create_department()) -- avoids slugifying
arbitrary user-entered menu item names."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, insert, select, update

from db.connection import get_session
from db.orm_models import MenuItem, MenuItemComboLine


def _set_combo_lines(session, hospital_id: int, combo_item_id: str, combo_lines: list[dict] | None) -> None:
    """Replaces a combo's lines wholesale (delete-then-insert) -- simplest correct approach for a
    form that always submits the complete set, never a single-line patch."""
    session.execute(delete(MenuItemComboLine).where(
        MenuItemComboLine.hospital_id == hospital_id, MenuItemComboLine.combo_item_id == combo_item_id,
    ))
    for line in combo_lines or []:
        session.execute(insert(MenuItemComboLine).values(
            hospital_id=hospital_id, combo_item_id=combo_item_id,
            component_item_id=line["component_item_id"], quantity=line["quantity"],
        ))


def create_menu_item(
    hospital_id: int, name: str, price_paise: int, description: str | None = None,
    category: str | None = None, stock_count: int | None = None, image_url: str | None = None,
    is_available: bool = True, is_combo: bool = False, combo_lines: list[dict] | None = None,
) -> dict:
    item_id = f"h{hospital_id}_{uuid.uuid4().hex[:8]}"
    session = get_session()
    session.execute(
        MenuItem.__table__.insert().values(
            id=item_id, hospital_id=hospital_id, name=name, description=description,
            price_paise=price_paise, category=category, is_available=is_available, stock_count=stock_count,
            image_url=image_url, is_combo=is_combo,
        )
    )
    if is_combo:
        _set_combo_lines(session, hospital_id, item_id, combo_lines)
    session.commit()
    return get_menu_item(hospital_id, item_id)


KEEP_STOCK = object()  # update_menu_item(stock_count=KEEP_STOCK): leave the live count alone


def update_menu_item(
    hospital_id: int, menu_item_id: str, name: str, price_paise: int, description: str | None = None,
    category: str | None = None, is_available: bool = True, stock_count: "int | None | object" = KEEP_STOCK,
    image_url: str | None = None, is_combo: bool = False, combo_lines: list[dict] | None = None,
) -> dict | None:
    """stock_count set here is a direct portal correction (a manual count adjustment) -- distinct from
    decrement_stock() below, which is the atomic per-order guard used at checkout, never a plain overwrite.
    Pass KEEP_STOCK (the default) when the caller isn't correcting the count: an edit form loaded a minute ago
    would otherwise write its stale count over the orders that have decremented it since."""
    values = dict(
        name=name, description=description, price_paise=price_paise, category=category,
        is_available=is_available, image_url=image_url, is_combo=is_combo,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    if stock_count is not KEEP_STOCK:
        values["stock_count"] = stock_count
    session = get_session()
    session.execute(update(MenuItem).where(MenuItem.hospital_id == hospital_id, MenuItem.id == menu_item_id).values(**values))
    # A combo edited back to a plain item, or a plain item's stray lines (shouldn't exist, but cheap
    # to guarantee): always reconcile lines to match the current is_combo state.
    _set_combo_lines(session, hospital_id, menu_item_id, combo_lines if is_combo else [])
    session.commit()
    return get_menu_item(hospital_id, menu_item_id)


def restock_menu_item(hospital_id: int, menu_item_id: str, add: int) -> dict | None:
    """Adds `add` to a counted item's stock in one atomic UPDATE (safe against orders landing at the same moment).
    None when the item doesn't exist or has unlimited stock (nothing to add to)."""
    session = get_session()
    row = session.execute(
        update(MenuItem)
        .where(MenuItem.hospital_id == hospital_id, MenuItem.id == menu_item_id, MenuItem.stock_count.is_not(None))
        .values(stock_count=MenuItem.stock_count + add, updated_at=datetime.now(timezone.utc).isoformat())
        .returning(MenuItem.id)
    ).first()
    session.commit()
    return get_menu_item(hospital_id, menu_item_id) if row else None


def set_menu_item_availability(hospital_id: int, menu_item_id: str, is_available: bool) -> dict | None:
    """The independent sold-out switch: hides/shows the item on WhatsApp without touching its stock count."""
    session = get_session()
    row = session.execute(
        update(MenuItem)
        .where(MenuItem.hospital_id == hospital_id, MenuItem.id == menu_item_id)
        .values(is_available=is_available, updated_at=datetime.now(timezone.utc).isoformat())
        .returning(MenuItem.id)
    ).first()
    session.commit()
    return get_menu_item(hospital_id, menu_item_id) if row else None


def list_menu_categories(hospital_id: int) -> list[str]:
    """Distinct categories in use, one spelling per case-insensitive name, alphabetical."""
    session = get_session()
    rows = session.execute(
        select(func.min(MenuItem.category))
        .where(MenuItem.hospital_id == hospital_id, MenuItem.category.is_not(None), func.trim(MenuItem.category) != "")
        .group_by(func.lower(func.trim(MenuItem.category)))
    ).all()
    return sorted((r[0].strip() for r in rows), key=str.lower)


def canonical_category(hospital_id: int, raw: str | None) -> str | None:
    """Blank -> None. A name that matches an existing category ignoring case/spacing takes that category's spelling
    -- the WhatsApp menu groups by exact text, so "starters" typed next to "Starters" must not become a second
    category. A genuinely new name is kept as typed (trimmed, inner spaces collapsed)."""
    name = " ".join((raw or "").split())
    if not name:
        return None
    for existing in list_menu_categories(hospital_id):
        if existing.lower() == name.lower():
            return existing
    return name


_ITEM_COLUMNS = (
    MenuItem.id, MenuItem.name, MenuItem.description, MenuItem.price_paise, MenuItem.category,
    MenuItem.is_available, MenuItem.stock_count, MenuItem.image_url, MenuItem.is_combo,
)


def _attach_combo_lines(hospital_id: int, items: list[dict]) -> list[dict]:
    """Batched, not N+1: one query for every combo's lines (joined to each component's own name/
    price), grouped back onto their combo -- same "fetch once, group in-memory" shape
    list_food_orders() already uses for order line items. Every item gets combo_lines (possibly [])
    and combo_item_count (the derived SUM(quantity), None for a non-combo)."""
    combo_ids = [i["id"] for i in items if i["is_combo"]]
    lines_by_combo: dict[str, list[dict]] = {cid: [] for cid in combo_ids}
    if combo_ids:
        session = get_session()
        component = MenuItem.__table__.alias("component")
        rows = session.execute(
            select(
                MenuItemComboLine.combo_item_id, MenuItemComboLine.component_item_id,
                MenuItemComboLine.quantity, component.c.name, component.c.price_paise,
            )
            .join(component, component.c.id == MenuItemComboLine.component_item_id)
            .where(MenuItemComboLine.hospital_id == hospital_id, MenuItemComboLine.combo_item_id.in_(combo_ids))
        ).all()
        for r in rows:
            lines_by_combo[r.combo_item_id].append({
                "component_item_id": r.component_item_id, "name": r.name,
                "price_paise": r.price_paise, "quantity": r.quantity,
            })
    for item in items:
        lines = lines_by_combo.get(item["id"], []) if item["is_combo"] else []
        item["combo_lines"] = lines
        item["combo_item_count"] = sum(ln["quantity"] for ln in lines) if item["is_combo"] else None
    return items


def get_menu_items(hospital_id: int, category: str | None = None, available_only: bool = True) -> list[dict]:
    """WhatsApp browse's own read point -- available_only=True (the default)
    excludes is_available=False AND stock_count=0 rows, same "enforcement
    point, not a crash" discipline get_tables()'s is_active filter
    establishes. The portal's own menu MANAGEMENT list uses
    available_only=False to still show sold-out/disabled items for editing."""
    session = get_session()
    stmt = select(*_ITEM_COLUMNS).where(MenuItem.hospital_id == hospital_id)
    if category is not None:
        stmt = stmt.where(MenuItem.category == category)
    if available_only:
        stmt = stmt.where(MenuItem.is_available.is_(True)).where(
            (MenuItem.stock_count.is_(None)) | (MenuItem.stock_count > 0)
        )
    rows = session.execute(stmt.order_by(MenuItem.category, MenuItem.name)).all()
    return _attach_combo_lines(hospital_id, [dict(r._mapping) for r in rows])


def get_menu_item(hospital_id: int, menu_item_id: str) -> dict | None:
    session = get_session()
    row = session.execute(
        select(*_ITEM_COLUMNS).where(MenuItem.hospital_id == hospital_id, MenuItem.id == menu_item_id)
    ).first()
    if row is None:
        return None
    return _attach_combo_lines(hospital_id, [dict(row._mapping)])[0]


def list_combo_candidates(hospital_id: int) -> list[dict]:
    """Every non-combo item, for the Add/Edit panel's "pick what's in this combo" dropdown -- a combo
    can't contain another combo."""
    session = get_session()
    rows = session.execute(
        select(MenuItem.id, MenuItem.name, MenuItem.price_paise)
        .where(MenuItem.hospital_id == hospital_id, MenuItem.is_combo.is_(False))
        .order_by(MenuItem.name)
    ).all()
    return [dict(r._mapping) for r in rows]


def decrement_stock(conn, menu_item_id: str, quantity: int) -> bool:
    """The atomic conditional-UPDATE the commerce reference doc establishes
    for stock protection, reused directly -- one statement covers both the
    unlimited case (stock_count IS NULL, CASE leaves it NULL, WHERE always
    matches) and the limited case (decremented only if enough remains).
    RETURNING proves the guard held; NULL back means insufficient stock.
    Runs on the CALLER's connection/transaction (create_food_order()'s own),
    not a fresh one -- so a failed decrement partway through a multi-item
    order can be rolled back along with everything else, same as
    create_table_reservation()'s advisory-locked transaction. Returns False
    on insufficient stock -- caller treats that as "one item in this order
    can no longer be fulfilled" and aborts the whole order."""
    row = conn.execute(
        "UPDATE menu_items SET stock_count = CASE WHEN stock_count IS NULL THEN NULL ELSE stock_count - ? END "
        "WHERE id = ? AND (stock_count IS NULL OR stock_count >= ?) "
        "RETURNING id",
        (quantity, menu_item_id, quantity),
    ).fetchone()
    return row is not None


def restore_stock(conn, menu_item_id: str, quantity: int) -> None:
    """The inverse of decrement_stock(): puts back what an order took when that
    order is cancelled (or its payment link could not be created). Unlimited
    items (stock_count IS NULL) are left NULL."""
    conn.execute(
        "UPDATE menu_items SET stock_count = stock_count + ? WHERE id = ? AND stock_count IS NOT NULL",
        (quantity, menu_item_id),
    )
