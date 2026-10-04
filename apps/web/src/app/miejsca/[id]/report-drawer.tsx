"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { checkReportNumber, reportRules, type AccessibilityAttribute, type FactValue } from "@krakow-bez-barier/contracts";
import {
  Button,
  Field,
  Input,
  RadioGroup,
  Textarea,
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
          // A number goes to the title instead: focusing its field would open the keyboard on its own.
          const target =
            contentRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
            contentRef.current?.querySelector<HTMLElement>("[data-report-title]");
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
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLElement>("label:has(:checked)");
    if (!row || !chip) return;
    // Set scrollLeft directly: scrollIntoView would also scroll the sheet and the page behind it.
    row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
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
    <form noValidate onSubmit={submit} className="overflow-y-auto overscroll-contain px-4 pt-4 pb-5">
      <VaulDrawerDescription id="report-place" className="text-body-sm text-muted-foreground">
        {placeName}
      </VaulDrawerDescription>
      <VaulDrawerTitle data-report-title tabIndex={-1} className="mt-1 font-display text-h2 font-bold outline-none">
        {mode === "fill" ? r.titleFill : r.titleCorrect}
      </VaulDrawerTitle>

      {/* data-vaul-no-drag: a horizontal swipe here scrolls the chips; Vaul would drag the whole sheet. */}
      <RadioGroup
        legend={r.which}
        variant="chip"
        value={attribute}
        onValueChange={pickAttribute}
        options={attributes.map((a) => ({ value: a, label: m.common.attribute[a] }))}
        className="mt-4"
        listRef={chipsRef}
        listProps={{ "data-vaul-no-drag": true }}
        listClassName="-mx-4 overflow-x-auto overscroll-x-contain px-4 pt-1 pb-2"
      />

      <div ref={valueRef} className="mt-3">
        {input.kind === "number" ? (
          <Field
            label={r.trueValue}
            labelExtra={r.numberLabel(unit)}
            hint={valueError ? undefined : r.numberHint(input.range.min, input.range.max, unit)}
            error={valueError}
          >
            <Input
              size="lg"
              type="number"
              inputMode="decimal"
              min={input.range.min}
              max={input.range.max}
              step="any"
              autoComplete="off"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              end={unit ? <span className="pr-3 text-body font-semibold text-muted-foreground">{unit}</span> : null}
            />
          </Field>
        ) : (
          <RadioGroup
            legend={r.trueValue}
            value={choice}
            onValueChange={(next) => {
              setChoice(next);
              setError(null);
            }}
            error={valueError}
            options={input.options.map((option, i) => ({
              value: option.id,
              label: option.label,
              inputProps: i === 0 ? { "data-autofocus": true } : undefined,
            }))}
          />
        )}
      </div>

      <Field
        label={r.comment}
        error={commentError}
        counter={
          maxComment !== undefined
            ? { count: comment.length, max: maxComment, label: m.common.form.characters(comment.length, maxComment) }
            : undefined
        }
        className="mt-4"
      >
        <Textarea
          ref={commentRef}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={r.commentPlaceholder}
          rows={2}
          className="min-h-16"
        />
      </Field>

      <Button type="submit" size="lg" className="mt-4 w-full">
        {r.send}
      </Button>
      <p className="mt-3 text-center text-caption text-muted-foreground">{r.noAccount}</p>
    </form>
  );
}
