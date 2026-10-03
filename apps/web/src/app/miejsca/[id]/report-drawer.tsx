"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { checkReportNumber, reportRules, type AccessibilityAttribute, type FactValue } from "@krakow-bez-barier/contracts";
import {
  Button,
  cn,
  VaulDrawer,
  VaulDrawerContent,
  VaulDrawerDescription,
  VaulDrawerTitle,
} from "@krakow-bez-barier/ui";
import { useLocale, useMessages } from "@/i18n/client";
import { formatValue } from "@/lib/place-facts";
import { reportInput, unitLabel } from "@/lib/reports";

export type ReportMode = "correct" | "fill";

export interface ReportSubmission {
  attribute: AccessibilityAttribute;
  value: FactValue;
  valueText: string;
  comment: string | null;
}

export interface ReportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeName: string;
  mode: ReportMode;
  attribute: AccessibilityAttribute;
  attributes: readonly AccessibilityAttribute[];
  /** Changes on every open, so the form starts empty each time. */
  formKey: number;
  onSubmit: (report: ReportSubmission) => void;
}

/** "To się nie zgadza" / "Uzupełnij" sheet: which attribute, its real value, an optional comment. */
export function ReportDrawer({ open, onOpenChange, placeName, mode, formKey, ...form }: ReportDrawerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <VaulDrawer open={open} onOpenChange={onOpenChange}>
      <VaulDrawerContent
        ref={contentRef}
        aria-describedby="report-place"
        onOpenAutoFocus={(e) => {
          // Land on the value, not the attribute chips: the attribute is already the one the visitor tapped.
          const target = contentRef.current?.querySelector<HTMLElement>("[data-autofocus]");
          if (!target) return;
          e.preventDefault();
          target.focus();
        }}
      >
        <ReportForm key={formKey} placeName={placeName} mode={mode} {...form} />
      </VaulDrawerContent>
    </VaulDrawer>
  );
}

type FieldError = { field: "value" | "comment"; message: string } | null;

function ReportForm({
  placeName,
  mode,
  attribute: initial,
  attributes,
  onSubmit,
}: Omit<ReportDrawerProps, "open" | "onOpenChange" | "formKey">) {
  const m = useMessages();
  const r = m.place.report;
  const locale = useLocale();
  const [attribute, setAttribute] = useState(initial);
  const [choice, setChoice] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<FieldError>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const input = reportInput(attribute, locale);
  const maxComment = reportRules.commentMaxLength ?? undefined;
  const unit = input.kind === "number" ? unitLabel(input.range, locale) : "";

  useEffect(() => {
    chipsRef.current?.querySelector("label:has(:checked)")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);

  const pickAttribute = (next: AccessibilityAttribute) => {
    setAttribute(next);
    setChoice(null);
    setNumber("");
    setError(null);
  };

  const validate = (): { value: FactValue } | NonNullable<FieldError> => {
    if (maxComment !== undefined && comment.length > maxComment) {
      return { field: "comment", message: r.error.commentTooLong(maxComment) };
    }
    if (input.kind === "number") {
      const check = checkReportNumber(attribute, number);
      if (!check.ok) {
        const { min, max } = input.range;
        const message = check.reason === "out_of_range" ? r.error.out_of_range(min, max, unit) : r.error[check.reason];
        return { field: "value", message };
      }
      return { value: { kind: "number", number: check.value, unit: input.range.unit } };
    }
    const option = input.options.find((o) => o.id === choice);
    return option ? { value: option.value } : { field: "value", message: r.error.choose };
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validate();
    if ("field" in result) {
      setError(result);
      if (result.field === "comment") commentRef.current?.focus();
      else valueRef.current?.querySelector<HTMLElement>("input")?.focus();
      return;
    }
    const formatted = formatValue(attribute, result.value, locale);
    onSubmit({
      attribute,
      value: result.value,
      valueText: formatted.unit ? `${formatted.value} ${formatted.unit}` : formatted.value,
      comment: comment.trim() || null,
    });
  };

  const valueError = error?.field === "value" ? error.message : null;
  const commentError = error?.field === "comment" ? error.message : null;

  return (
    <form noValidate onSubmit={submit} className="overflow-y-auto px-4 pt-4 pb-5">
      <VaulDrawerDescription id="report-place" className="text-body-sm text-muted-foreground">
        {placeName}
      </VaulDrawerDescription>
      <VaulDrawerTitle className="mt-1 font-display text-h2 font-bold">
        {mode === "fill" ? r.titleFill : r.titleCorrect}
      </VaulDrawerTitle>

      <fieldset className="mt-4">
        <legend className="mb-2 text-body-sm font-semibold">{r.which}</legend>
        <div ref={chipsRef} className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-2">
          {attributes.map((a) => (
            <label
              key={a}
              className={cn(
                "flex h-10 shrink-0 cursor-pointer items-center rounded-full bg-card px-3.5 text-sm font-semibold whitespace-nowrap ring-1 ring-border hover:bg-muted",
                "has-checked:bg-primary-container has-checked:ring-2 has-checked:ring-primary",
                "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
              )}
            >
              <input
                type="radio"
                name="report-attribute"
                value={a}
                checked={attribute === a}
                onChange={() => pickAttribute(a)}
                className="sr-only"
              />
              {m.common.attribute[a]}
            </label>
          ))}
        </div>
      </fieldset>

      {input.kind === "number" ? (
        <div ref={valueRef} className="mt-3">
          <label htmlFor="report-number" className="mb-2 block text-body-sm font-semibold">
            {r.trueValue} <span className="sr-only">{r.numberLabel(unit)}</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="report-number"
              data-autofocus
              inputMode="decimal"
              autoComplete="off"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              aria-invalid={!!valueError}
              aria-describedby="report-number-hint"
              className="h-14 min-w-0 flex-1 rounded-2xl border border-input bg-card px-4 font-display text-[22px] font-extrabold tabular-nums outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-status-barrier"
            />
            {unit ? <span className="text-body font-semibold text-muted-foreground">{unit}</span> : null}
          </div>
          <p
            id="report-number-hint"
            className={cn("mt-1.5 text-caption", valueError ? "font-semibold text-status-barrier" : "text-muted-foreground")}
          >
            {valueError ?? r.numberHint(input.range.min, input.range.max, unit)}
          </p>
        </div>
      ) : (
        <fieldset className="mt-3" aria-describedby={valueError ? "report-choice-error" : undefined}>
          <legend className="mb-2 text-body-sm font-semibold">{r.trueValue}</legend>
          <div ref={valueRef} className="grid gap-2.5">
            {input.options.map((option, i) => (
              <label
                key={option.id}
                className={cn(
                  "group flex h-14 cursor-pointer items-center gap-3 rounded-2xl bg-surface-raised px-4 text-body font-semibold ring-1 ring-border-strong/40",
                  "has-checked:bg-primary-container has-checked:ring-2 has-checked:ring-primary",
                  "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                )}
              >
                <input
                  type="radio"
                  name="report-value"
                  value={option.id}
                  checked={choice === option.id}
                  onChange={() => {
                    setChoice(option.id);
                    setError(null);
                  }}
                  data-autofocus={i === 0 ? true : undefined}
                  className="peer sr-only"
                />
                <span className="flex-1">{option.label}</span>
                <span
                  aria-hidden
                  className="grid size-6 place-items-center rounded-full ring-2 ring-border-strong/60 peer-checked:bg-primary peer-checked:ring-primary"
                >
                  <span className="size-2.5 rounded-full bg-primary-foreground opacity-0 group-has-checked:opacity-100" />
                </span>
              </label>
            ))}
          </div>
          {valueError ? (
            <p id="report-choice-error" className="mt-1.5 text-caption font-semibold text-status-barrier">
              {valueError}
            </p>
          ) : null}
        </fieldset>
      )}

      <label htmlFor="report-comment" className="mt-4 mb-2 block text-body-sm font-semibold">
        {r.comment}
      </label>
      <textarea
        id="report-comment"
        ref={commentRef}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={r.commentPlaceholder}
        rows={2}
        aria-invalid={!!commentError}
        aria-describedby={commentError ? "report-comment-error" : undefined}
        className="min-h-16 w-full rounded-2xl border border-input bg-card px-4 py-3 text-body-sm outline-none placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-status-barrier"
      />
      {commentError ? (
        <p id="report-comment-error" className="mt-1.5 text-caption font-semibold text-status-barrier">
          {commentError}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-4 w-full">
        {r.send}
      </Button>
      <p className="mt-3 text-center text-caption text-muted-foreground">{r.noAccount}</p>
    </form>
  );
}
