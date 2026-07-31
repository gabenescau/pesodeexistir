"use client";

import * as React from "react";
import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function AlertDialog(props) {
  return <BaseAlertDialog.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger(props) {
  return <BaseAlertDialog.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal(props) {
  return <BaseAlertDialog.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogBackdrop({ className, ...props }) {
  return (
    <BaseAlertDialog.Backdrop
      data-slot="alert-dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
        "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        "transition-opacity duration-150",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogViewport({ className, ...props }) {
  return (
    <BaseAlertDialog.Viewport
      data-slot="alert-dialog-viewport"
      className={cn("fixed inset-0 z-50 flex items-end justify-center sm:items-center", className)}
      {...props}
    />
  );
}

function AlertDialogPopup({ className, children, ...props }) {
  return (
    <AlertDialogPortal>
      <AlertDialogBackdrop />
      <AlertDialogViewport>
        <BaseAlertDialog.Popup
          data-slot="alert-dialog-popup"
          className={cn(
            "w-full max-w-md gap-4 rounded-t-[16px] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[0_24px_60px_rgba(0,0,0,.4)]",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            "data-[starting-style]:translate-y-2 data-[ending-style]:translate-y-2",
            "transition-all duration-200 sm:rounded-[16px] sm:data-[starting-style]:translate-y-0 sm:data-[ending-style]:translate-y-0",
            className
          )}
          {...props}
        >
          {children}
        </BaseAlertDialog.Popup>
      </AlertDialogViewport>
    </AlertDialogPortal>
  );
}

const AlertDialogContent = AlertDialogPopup;

function AlertDialogHeader({ className, ...props }) {
  return (
    <div data-slot="alert-dialog-header" className={cn("flex flex-col gap-1.5", className)} {...props} />
  );
}

function AlertDialogFooter({ className, variant = "default", children, ...props }) {
  return (
    <div
      data-slot="alert-dialog-footer"
      data-variant={variant}
      className={cn(
        "mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        variant === "default" && "border-t border-[var(--border)] -mx-6 -mb-6 mt-4 rounded-b-[16px] bg-[var(--hover-overlay)] px-4 py-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function AlertDialogTitle({ className, ...props }) {
  return (
    <BaseAlertDialog.Title
      data-slot="alert-dialog-title"
      className={cn("text-base font-semibold text-[var(--text-primary)]", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({ className, ...props }) {
  return (
    <BaseAlertDialog.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm text-[var(--text-muted)]", className)}
      {...props}
    />
  );
}

function AlertDialogClose({ className, render, variant = "outline", ...props }) {
  return (
    <BaseAlertDialog.Close
      data-slot="alert-dialog-close"
      render={
        render ?? (
          <Button variant={variant} className={cn("min-h-10", className)} />
        )
      }
      {...props}
    />
  );
}

function AlertDialogAction({ className, render, ...props }) {
  return (
    <BaseAlertDialog.Close
      data-slot="alert-dialog-action"
      render={
        render ?? (
          <Button className={cn("min-h-10 bg-[var(--text-primary)] text-[var(--bg-card)]", className)} />
        )
      }
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogBackdrop,
  AlertDialogViewport,
  AlertDialogPopup,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
  AlertDialogAction,
};
