import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Checkbox, RadioGroup } from "./choice";
import { describedBy, Field } from "./field";
import { Input } from "./input";
import { Textarea } from "./textarea";

const attr = (html: string, tag: string, name: string) => html.match(new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`))?.[1];

describe("Field", () => {
  it("labels the control and ties the hint to it", () => {
    // GIVEN a field with a label and a hint
    // WHEN rendered around an input
    const html = renderToStaticMarkup(
      <Field id="name" label="Nazwa" hint="Np. Koncert">
        <Input value="" onChange={() => undefined} />
      </Field>,
    );

    // THEN the visible label points at the input and the hint describes it
    expect(html).toContain('<label for="name"');
    expect(attr(html, "input", "id")).toBe("name");
    expect(attr(html, "input", "aria-describedby")).toBe("name-hint");
    expect(html).toContain('id="name-hint"');
    expect(attr(html, "input", "aria-invalid")).toBeUndefined();
  });

  it("marks the control invalid and reads the error before the hint", () => {
    // GIVEN a field with an error and a hint, and the control's own description
    // WHEN rendered around a textarea
    const html = renderToStaticMarkup(
      <Field id="comment" label="Komentarz" hint="Opcjonalnie" error="Za długi">
        <Textarea aria-describedby="lead" />
      </Field>,
    );

    // THEN the error comes first, then the hint, then the control's own description
    expect(attr(html, "textarea", "aria-describedby")).toBe("comment-error comment-hint lead");
    expect(attr(html, "textarea", "aria-invalid")).toBe("true");
    // AND the error carries an icon next to its text, not colour alone
    expect(html).toMatch(/id="comment-error"[^>]*><svg[^>]*aria-hidden="true"/);
  });

  it("reads the character counter as words, not as the visible fraction", () => {
    // GIVEN a field with a counter
    // WHEN rendered around a textarea
    const html = renderToStaticMarkup(
      <Field id="note" label="Notatka" counter={{ count: 12, max: 500, label: "12 z 500 znaków" }}>
        <Textarea />
      </Field>,
    );

    // THEN the counter describes the textarea, the fraction is hidden and the words are there for screen readers
    expect(attr(html, "textarea", "aria-describedby")).toBe("note-count");
    expect(html).toMatch(/id="note-count"[^>]*><span aria-hidden="true">12/);
    expect(html).toContain('<span class="sr-only">12 z 500 znaków</span>');
  });

  it("disables the control when the field is disabled", () => {
    // GIVEN a disabled field
    // WHEN rendered
    const html = renderToStaticMarkup(
      <Field id="d" label="Wyłączone" disabled>
        <Input value="x" onChange={() => undefined} />
      </Field>,
    );

    // THEN the input itself is disabled
    expect(html).toMatch(/<input[^>]*disabled=""/);
  });
});

describe("Input", () => {
  it("shows the clear button only while there is text", () => {
    // GIVEN a field that can be cleared
    const field = (value: string) =>
      renderToStaticMarkup(<Input aria-label="Szukaj" value={value} onChange={() => undefined} onClear={() => undefined} clearLabel="Wyczyść" />);

    // WHEN it is empty, and when it holds text
    // THEN only the second offers "Wyczyść"
    expect(field("")).not.toContain("Wyczyść");
    expect(field("Sukiennice")).toContain('aria-label="Wyczyść"');
  });

  it("uses at least 16 px text so iOS does not zoom on focus", () => {
    // GIVEN any text field
    // WHEN rendered
    const html = renderToStaticMarkup(<Input aria-label="Nazwa" />);

    // THEN its text uses the 17 px body size
    expect(attr(html, "input", "class")).toContain("text-body");
  });
});

describe("RadioGroup", () => {
  it("is a fieldset whose legend names it and whose error describes it", () => {
    // GIVEN a radio group with an error and nothing chosen
    // WHEN rendered
    const html = renderToStaticMarkup(
      <RadioGroup
        legend="Jak jest naprawdę?"
        value={null}
        onValueChange={() => undefined}
        error="Wybierz odpowiedź."
        options={[
          { value: "yes", label: "Jest" },
          { value: "no", label: "Nie ma" },
        ]}
      />,
    );

    // THEN the native radios share one name, none is checked, and the error describes the group
    expect(html).toContain("<legend");
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).not.toContain("checked=\"\"");
    const errorId = html.match(/<fieldset[^>]*aria-describedby="([^"]*)"/)?.[1];
    expect(errorId).toBeTruthy();
    expect(html).toContain(`id="${errorId}"`);
  });
});

describe("Checkbox", () => {
  it("marks the box invalid and ties its error to it", () => {
    // GIVEN an unticked checkbox with an error
    // WHEN rendered
    const html = renderToStaticMarkup(<Checkbox label="Rozumiem" checked={false} onCheckedChange={() => undefined} error="Zaznacz." />);

    // THEN the native checkbox is invalid and described by the error, which sits outside the label
    expect(attr(html, "input", "aria-invalid")).toBe("true");
    const errorId = attr(html, "input", "aria-describedby");
    expect(html).toMatch(new RegExp(`</label><p id="${errorId}"`));
  });
});

describe("describedBy", () => {
  it("drops empty parts", () => {
    // GIVEN some missing ids
    // WHEN joined
    // THEN only the real ones remain, and nothing at all gives undefined
    expect(describedBy("a", undefined, false, "b")).toBe("a b");
    expect(describedBy(undefined, null)).toBeUndefined();
  });
});
