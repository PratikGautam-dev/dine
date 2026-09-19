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

from sqlalchemy import select, update

from db.connection import get_session
from db.orm_models import MenuItem


def create_menu_item(
    hospital_id: int, name: str, price_paise: int, description: str | None = None,
    category: str | None = None, stock_count: int | None = None, image_url: str | None = None,
    is_available: bool = True,
) -> dict:
    item_id = f"h{hospital_id}_{uuid.uuid4().hex[:8]}"
    session = get_session()
    session.execute(
        MenuItem.__table__.insert().values(
            id=item_id, hospital_id=hospital_id, name=name, description=description,
            price_paise=price_paise, category=category, is_available=is_available, stock_count=stock_count,
            image_url=image_url,
        )
    )
    session.commit()
    return get_menu_item(hospital_id, item_id)


def update_menu_item(
    hospital_id: int, menu_item_id: str, name: str, price_paise: int, description: str | None = None,
    category: str | None = None, is_available: bool = True, stock_count: int | None = None,
    image_url: str | None = None,
) -> dict | None:
    """stock_count set here is a direct portal correction (e.g. the daily
    "reset stock" action, or a manual count adjustment) -- distinct from
    decrement_stock() below, which is the atomic per-order guard used at
    checkout, never a plain overwrite."""
    session = get_session()
    session.execute(
        update(MenuItem).where(MenuItem.hospital_id == hospital_id, MenuItem.id == menu_item_id).values(
            name=name, description=description, price_paise=price_paise, category=category,
            is_available=is_available, stock_count=stock_count, image_url=image_url,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
    )
    session.commit()
    return get_menu_item(hospital_id, menu_item_id)


def get_menu_items(hospital_id: int, category: str | None = None, available_only: bool = True) -> list[dict]:
    """WhatsApp browse's own read point -- available_only=True (the default)
    excludes is_available=False AND stock_count=0 rows, same "enforcement
    point, not a crash" discipline get_tables()'s is_active filter
    establishes. The portal's own menu MANAGEMENT list uses
    available_only=False to still show sold-out/disabled items for editing."""
    session = get_session()
    stmt = select(
        MenuItem.id, MenuItem.name, MenuItem.description, MenuItem.price_paise, MenuItem.category,
        MenuItem.is_available, MenuItem.stock_count, MenuItem.image_url,
    ).where(MenuItem.hospital_id == hospital_id)
    if category is not None:
        stmt = stmt.where(MenuItem.category == category)
    if available_only:
        stmt = stmt.where(MenuItem.is_available.is_(True)).where(
            (MenuItem.stock_count.is_(None)) | (MenuItem.stock_count > 0)
        )
    rows = session.execute(stmt.order_by(MenuItem.category, MenuItem.name)).all()
    return [dict(r._mapping) for r in rows]


def get_menu_item(hospital_id: int, menu_item_id: str) -> dict | None:
    session = get_session()
    row = session.execute(
        select(
            MenuItem.id, MenuItem.name, MenuItem.description, MenuItem.price_paise, MenuItem.category,
            MenuItem.is_available, MenuItem.stock_count, MenuItem.image_url,
        ).where(MenuItem.hospital_id == hospital_id, MenuItem.id == menu_item_id)
    ).first()
    return dict(row._mapping) if row else None


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
