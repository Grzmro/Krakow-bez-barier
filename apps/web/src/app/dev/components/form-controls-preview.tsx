"use client";

import { useId, useState, type ReactNode } from "react";
import { MagnifyingGlass, MapPin } from "@phosphor-icons/react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import {
  Checkbox,
  ComboboxPopup,
  Field,
  Input,
  InputClearButton,
  InputGroup,
  inputControlClass,
  LabeledSwitch,
  NumberStepper,
  RadioGroup,
  Select,
  Textarea,
  Toggle,
  ToggleGroup,
  optionClass,
} from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";

const COMMENT_MAX = 40;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="font-heading text-title font-bold">{title}</h3>
      {children}
    </div>
  );
}

/** Every form control from @krakow-bez-barier/ui in every state; rendered once per theme. */
export function FormControlsPreview() {
  const m = useMessages();
  const t = m.dev.forms;
  const comboId = useId();
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState(t.searchValue);
  const [width, setWidth] = useState("5");
  const [comment, setComment] = useState(t.commentLong);
  const [district, setDistrict] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [consent, setConsent] = useState(false);
  const [show, setShow] = useState(false);
  const [answer, setAnswer] = useState<string | null>("yes");
  const [unanswered, setUnanswered] = useState<string | null>(null);
  const [attribute, setAttribute] = useState("door");
  const [profile, setProfile] = useState("wheelchair");
  const [sort, setSort] = useState("distance");
  const [hide, setHide] = useState(false);
  const [noSteps, setNoSteps] = useState(true);
  const [chips, setChips] = useState<string[]>(["lift"]);
  const [kind, setKind] = useState("short");
  const [threshold, setThreshold] = useState(2);
  const districts = Object.entries(t.districts).map(([value, label]) => ({ value, label }));
  const toggleChip = (chip: string) => setChips((on) => (on.includes(chip) ? on.filter((c) => c !== chip) : [...on, chip]));

  return (
    <div className="space-y-8">
      <Group title={t.text}>
        <Field label={t.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} />
        </Field>
        <Field label={t.search} hint={t.hint}>
          <Input
            type="search"
            startIcon={<MagnifyingGlass />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            clearLabel={t.clear}
          />
        </Field>
        <Field label={t.token} error={t.tokenError}>
          <Input type="password" value="" onChange={() => undefined} />
        </Field>
        <Field label={t.width} labelExtra={t.unit} hint={t.widthHint}>
          <Input
            size="lg"
            type="number"
            inputMode="decimal"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            end={<span className="pr-3 text-body font-semibold text-muted-foreground">{t.unit}</span>}
          />
        </Field>
        <Field label={t.disabled} disabled>
          <Input value={t.disabledValue} onChange={() => undefined} />
        </Field>
        <Field label={t.readOnly}>
          <Input value={t.readOnlyValue} readOnly />
        </Field>
        <Field label={t.floating} labelHidden>
          <Input variant="floating" size="floating" startIcon={<MagnifyingGlass className="size-[22px]" />} placeholder={t.floatingPlaceholder} />
        </Field>
      </Group>

      <Group title={t.combobox}>
        <Autocomplete.Root items={t.comboboxItems} value={query} onValueChange={setQuery}>
          <Field id={comboId} label={t.comboboxLabel}>
            <Autocomplete.InputGroup className="flex">
              <InputGroup
                startIcon={<MagnifyingGlass />}
                end={query ? <InputClearButton label={t.clear} onClick={() => setQuery("")} /> : null}
              >
                <Autocomplete.Input id={comboId} className={inputControlClass} placeholder={t.floatingPlaceholder} />
              </InputGroup>
            </Autocomplete.InputGroup>
          </Field>
          <ComboboxPopup label={t.comboboxSuggestions}>
            {(name: string) => (
              <Autocomplete.Item key={name} value={name} className={optionClass}>
                <MapPin weight="duotone" className="size-5 shrink-0 text-primary" aria-hidden />
                {name}
              </Autocomplete.Item>
            )}
          </ComboboxPopup>
        </Autocomplete.Root>
      </Group>

      <Group title={t.textarea}>
        <Field
          label={t.comment}
          counter={{ count: comment.length, max: COMMENT_MAX, label: m.common.form.characters(comment.length, COMMENT_MAX) }}
          error={comment.length > COMMENT_MAX ? t.commentError : undefined}
        >
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.commentPlaceholder} rows={2} />
        </Field>
        <Field label={t.comment} counter={{ count: 0, max: COMMENT_MAX, label: m.common.form.characters(0, COMMENT_MAX) }}>
          <Textarea placeholder={t.commentPlaceholder} rows={2} />
        </Field>
        <Field label={t.commentDisabled} disabled>
          <Textarea value={t.commentLong} onChange={() => undefined} rows={2} />
        </Field>
      </Group>

      <Group title={t.select}>
        <Field label={t.district} hint={t.districtHint} error={district ? undefined : t.districtError}>
          <Select items={districts} value={district} onValueChange={setDistrict} placeholder={t.districtPlaceholder} />
        </Field>
        <Field label={t.districtDisabled} disabled>
          <Select items={districts} value="kazimierz" onValueChange={() => undefined} />
        </Field>
      </Group>

      <Group title={t.choice}>
        <div>
          <Checkbox label={t.remember} hint={t.rememberHint} checked={remember} onCheckedChange={setRemember} />
          <Checkbox label={t.show} checked={show} onCheckedChange={setShow} />
          <Checkbox label={t.disabledCheckbox} checked={false} onCheckedChange={() => undefined} disabled />
          <Checkbox label={t.consent} checked={consent} onCheckedChange={setConsent} error={consent ? undefined : t.consentError} />
        </div>
        <RadioGroup
          legend={t.trueValue}
          value={answer}
          onValueChange={setAnswer}
          options={[
            { value: "yes", label: t.yes },
            { value: "no", label: t.no },
          ]}
        />
        <RadioGroup
          legend={t.trueValue}
          value={unanswered}
          onValueChange={setUnanswered}
          error={unanswered ? undefined : t.chooseError}
          options={[
            { value: "yes", label: t.yes },
            { value: "no", label: t.no },
          ]}
        />
        <RadioGroup
          legend={t.which}
          variant="chip"
          value={attribute}
          onValueChange={setAttribute}
          listClassName="flex-wrap"
          options={Object.entries(t.attributes).map(([value, label]) => ({ value, label }))}
        />
        <RadioGroup
          legend={t.profile}
          variant="segmented"
          value={profile}
          onValueChange={setProfile}
          options={Object.entries(t.profiles).map(([value, label]) => ({ value, label, className: "flex-1" }))}
        />
        <RadioGroup
          legend={t.plain}
          variant="plain"
          value={sort}
          onValueChange={setSort}
          options={Object.entries(t.plainOptions).map(([value, label]) => ({ value, label }))}
        />
      </Group>

      <Group title={t.switches}>
        <div className="divide-y divide-border">
          <LabeledSwitch label={t.switchOff} checked={hide} onCheckedChange={setHide} />
          <LabeledSwitch label={t.switchOn} hint={t.switchHint} checked={noSteps} onCheckedChange={setNoSteps} />
          <LabeledSwitch label={t.switchDisabled} checked={false} onCheckedChange={() => undefined} disabled />
        </div>
        <div role="group" aria-label={t.chips} className="flex flex-wrap gap-2">
          {(["stairs", "lift", "toilet"] as const).map((chip) => (
            <Toggle key={chip} pressed={chips.includes(chip)} onPressedChange={() => toggleChip(chip)}>
              {chip === "stairs" ? t.chipStairs : chip === "lift" ? t.chipLift : t.chipToilet}
            </Toggle>
          ))}
          <Toggle disabled>{t.chipToilet}</Toggle>
        </div>
        <ToggleGroup aria-label={t.group} value={[kind]} onValueChange={(value) => value[0] && setKind(value[0])}>
          <Toggle value="short">{t.groupShort}</Toggle>
          <Toggle value="stairs">{t.groupStairs}</Toggle>
        </ToggleGroup>
        <NumberStepper
          label={t.stepper}
          value={threshold}
          min={0}
          max={10}
          step={1}
          unit={t.unit}
          decreaseLabel={t.decrease}
          increaseLabel={t.increase}
          onChange={setThreshold}
        />
      </Group>
    </div>
  );
}
