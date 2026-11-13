"use client";

import {
  Children,
  Fragment,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from "react";
import { AnchoredSelect } from "@/components/erp-ui/AnchoredSelect";

type Option = { value: string; label: ReactNode; disabled?: boolean };

/** Keep declarative option lists while all menus share viewport-aware positioning. */
function collectOptions(children: ReactNode): Option[] {
  const options: Option[] = [];
  Children.forEach(children, (child) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
        label?: string;
      }>(child)
    )
      return;
    if (child.type === Fragment) {
      options.push(...collectOptions(child.props.children));
    } else if (child.type === "option") {
      const { value, children: label, disabled } = child.props;
      options.push({
        value: String(value ?? label ?? ""),
        label: child.props.label ?? label,
        disabled,
      });
    }
  });
  return options;
}

type SelectProps = Omit<
  ComponentProps<typeof AnchoredSelect<string>>,
  "options" | "label" | "compact" | "value" | "defaultValue"
> & {
  children: ReactNode;
  value?: string | number;
  defaultValue?: string | number;
};

export function Select({
  children,
  value,
  defaultValue,
  ...props
}: SelectProps) {
  return (
    <AnchoredSelect
      {...props}
      value={value === undefined ? undefined : String(value)}
      defaultValue={
        defaultValue === undefined ? undefined : String(defaultValue)
      }
      options={collectOptions(children)}
    />
  );
}
