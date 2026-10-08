"use client";

// Ported from dine-client's components/menu/MenuGrid.tsx -- visual card layouts only
// (BigCard/Tile/Row item treatments + the stock/stepper logic). dine-client's own
// OUTLET_MENU_ITEMS hardcoded data is NOT used here; every item rendered is real, passed in by
// [slug]/page.tsx from the live GET /api/public/restaurants/:slug response.
import { cn } from "@/lib/cn";
import { rupees } from "@/lib/foodOrders";
import type { Category, MenuItem } from "./types";

type StepperProps = { item: MenuItem; quantity: number; closed: boolean; onAdd: () => void; onSetQuantity: (q: number) => void; compact?: boolean };

function Stepper({ item, quantity, closed, onAdd, onSetQuantity, compact = false }: StepperProps) {
  const soldOut = item.stock_count !== null && item.stock_count <= 0;
  if (soldOut) return <span className="font-sf-body text-[11.5px] font-semibold text-sf-text-muted">Sold out</span>;
  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={closed}
        aria-label={`Add ${item.name}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border-2 border-sf-primary font-sf-body font-bold text-sf-primary transition-colors hover:bg-sf-primary-light disabled:cursor-not-allowed disabled:opacity-40",
          compact ? "h-8 w-8 justify-center" : "px-4 py-1.5 text-[13.5px]",
        )}
      >
        {compact ? <span className="material-symbols-outlined text-[16px]">add</span> : (
          <>
            Add <span className="material-symbols-outlined text-[16px]">add</span>
          </>
        )}
      </button>
    );
  }
  return (
    <div className="inline-flex items-center rounded-full bg-sf-primary text-sf-on-primary">
      <button type="button" onClick={() => onSetQuantity(quantity - 1)} aria-label="Decrease quantity" className="flex h-8 w-8 items-center justify-center">
        <span className="material-symbols-outlined text-[16px]">remove</span>
      </button>
      <span className="w-4 text-center font-sf-body text-[13px] font-bold">{quantity}</span>
      <button type="button" onClick={() => onSetQuantity(quantity + 1)} aria-label="Increase quantity" className="flex h-8 w-8 items-center justify-center">
        <span className="material-symbols-outlined text-[16px]">add</span>
      </button>
    </div>
  );
}

function Photo({ item, className }: { item: MenuItem; className?: string }) {
  return item.image_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.image_url} alt="" className={cn("object-cover", className)} />
  ) : (
    <div className={cn("flex items-center justify-center bg-sf-primary-light text-sf-primary/50", className)}>
      <span className="material-symbols-outlined text-[24px]">restaurant</span>
    </div>
  );
}

function ComboBadge() {
  return (
    <span className="ml-1 rounded-full bg-sf-tertiary/10 px-2 py-0.5 font-sf-body text-[10px] font-bold uppercase text-sf-tertiary">
      Combo
    </span>
  );
}

type ItemProps = { item: MenuItem; quantity: number; closed: boolean; onAdd: () => void; onSetQuantity: (q: number) => void };

export function BigCard({ item, quantity, closed, onAdd, onSetQuantity }: ItemProps) {
  return (
    <div className="flex w-[210px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-sf-border-divider bg-sf-surface shadow-sm">
      <Photo item={item} className="h-[130px] w-full" />
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 font-sf-body text-[14.5px] font-bold leading-snug text-sf-on-surface">
          {item.name} {item.is_combo && <ComboBadge />}
        </p>
        <p className="mt-1 font-sf-headline text-[15px] font-extrabold text-sf-on-surface">{rupees(item.price_paise)}</p>
        {item.description && <p className="mt-1 line-clamp-2 font-sf-body text-[12px] text-sf-text-muted">{item.description}</p>}
        <div className="mt-auto flex justify-end pt-3">
          <Stepper item={item} quantity={quantity} closed={closed} onAdd={onAdd} onSetQuantity={onSetQuantity} />
        </div>
      </div>
    </div>
  );
}

export function Tile({ item, quantity, closed, onAdd, onSetQuantity }: ItemProps) {
  return (
    <div className="w-[128px] shrink-0 snap-start overflow-hidden rounded-2xl border border-sf-border-divider bg-sf-surface shadow-sm">
      <Photo item={item} className="h-[92px] w-full" />
      <div className="p-2">
        <p className="truncate font-sf-body text-[13px] font-bold text-sf-on-surface">{item.name}</p>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-sf-body text-[13px] font-extrabold text-sf-on-surface">{rupees(item.price_paise)}</span>
          <Stepper item={item} quantity={quantity} closed={closed} onAdd={onAdd} onSetQuantity={onSetQuantity} compact />
        </div>
      </div>
    </div>
  );
}

export function Row({ item, quantity, closed, onAdd, onSetQuantity }: ItemProps) {
  return (
    <div className="flex gap-3 rounded-2xl border border-sf-border-divider bg-sf-surface p-3 shadow-sm">
      <Photo item={item} className="h-[88px] w-[88px] shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate font-sf-body text-[14.5px] font-bold text-sf-on-surface">
          {item.name} {item.is_combo && <ComboBadge />}
        </p>
        {item.description && <p className="line-clamp-2 font-sf-body text-[12px] text-sf-text-muted">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-sf-headline text-[15px] font-extrabold text-sf-on-surface">{rupees(item.price_paise)}</span>
          <Stepper item={item} quantity={quantity} closed={closed} onAdd={onAdd} onSetQuantity={onSetQuantity} />
        </div>
      </div>
    </div>
  );
}

type GridProps = {
  search: string;
  searchResults: MenuItem[];
  bestsellers: MenuItem[];
  recommended: MenuItem[];
  visibleCategories: Category[];
  activeCat: string;
  categoriesEmpty: boolean;
  quantityFor: (itemId: string) => number;
  closed: boolean;
  onAdd: (item: MenuItem) => void;
  onSetQuantity: (itemId: string, q: number) => void;
  onPickCategory: (key: string) => void;
  BESTSELLERS: string;
  ALL: string;
};

export function MenuGrid({
  search, searchResults, bestsellers, recommended, visibleCategories, activeCat, categoriesEmpty,
  quantityFor, closed, onAdd, onSetQuantity, onPickCategory, BESTSELLERS, ALL,
}: GridProps) {
  const rowProps = (item: MenuItem) => ({
    item,
    quantity: quantityFor(item.id),
    closed,
    onAdd: () => onAdd(item),
    onSetQuantity: (q: number) => onSetQuantity(item.id, q),
  });

  if (search) {
    return (
      <section>
        <h2 className="mb-3 font-sf-headline text-[18px] font-extrabold text-sf-on-surface">
          Results for &ldquo;{search}&rdquo;
        </h2>
        {searchResults.length === 0 ? (
          <p className="py-6 text-center font-sf-body text-[13.5px] text-sf-text-muted">Nothing matches that. Try another dish.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {searchResults.map((i) => <Row key={i.id} {...rowProps(i)} />)}
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      {(activeCat === ALL || activeCat === BESTSELLERS) && bestsellers.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-sf-headline text-[20px] font-extrabold text-sf-on-surface">Bestsellers</h2>
            {activeCat === ALL && (
              <button type="button" onClick={() => onPickCategory(BESTSELLERS)} className="inline-flex items-center gap-1 font-sf-body text-[13px] font-bold text-sf-primary">
                See all <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            )}
          </div>
          {activeCat === BESTSELLERS ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {bestsellers.map((i) => <Row key={i.id} {...rowProps(i)} />)}
            </div>
          ) : (
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
              {bestsellers.map((i) => <BigCard key={i.id} {...rowProps(i)} />)}
            </div>
          )}
        </section>
      )}

      {activeCat === ALL && recommended.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-sf-headline text-[20px] font-extrabold text-sf-on-surface">Recommended for you</h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {recommended.map((i) => <Tile key={i.id} {...rowProps(i)} />)}
          </div>
        </section>
      )}

      {activeCat !== BESTSELLERS && visibleCategories.map((cat) => (
        <section key={cat.name} className="mb-6">
          <h2 className="mb-3 font-sf-headline text-[20px] font-extrabold text-sf-on-surface">{cat.name}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {cat.items.map((i) => <Row key={i.id} {...rowProps(i)} />)}
          </div>
        </section>
      ))}

      {categoriesEmpty && <p className="py-8 text-center font-sf-body text-[13.5px] text-sf-text-muted">No menu items yet.</p>}
    </>
  );
}
