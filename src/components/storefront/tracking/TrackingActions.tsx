// Re-skinned from dine-client's components/tracking/TrackingActions.tsx. The reference's "View
// Invoice" / "Share Link" buttons have no real backend counterpart here and are dropped rather
// than faked; what remains is the real cancel flow -- same CANCELLABLE_STATUSES gating, same
// ConfirmDialog component (@/components/ui/ConfirmDialog) and cancelOrder() call as the page had
// before this re-skin, just moved into its own component.
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Props = {
  cancellable: boolean;
  cancelling: boolean;
  confirmOpen: boolean;
  onRequestCancel: () => void;
  onConfirmCancel: () => void;
  onDismissConfirm: () => void;
};

export function TrackingActions({
  cancellable,
  cancelling,
  confirmOpen,
  onRequestCancel,
  onConfirmCancel,
  onDismissConfirm,
}: Props) {
  if (!cancellable) return null;

  return (
    <>
      <Button variant="destructive" className="w-full" onClick={onRequestCancel}>
        Cancel order
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Cancel this order?"
        message="The restaurant will be notified immediately. This can't be undone."
        confirmLabel="Cancel order"
        destructive
        busy={cancelling}
        onConfirm={onConfirmCancel}
        onCancel={onDismissConfirm}
      />
    </>
  );
}
