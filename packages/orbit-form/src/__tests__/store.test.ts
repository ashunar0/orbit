import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { createFormStore } from "../store";

const userSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("メールアドレスの形式が不正です"),
  age: z.coerce.number().min(0, "0以上を入力してください").optional(),
});

type UserInput = z.input<typeof userSchema>;

const defaults: UserInput = { name: "", email: "", age: undefined };

describe("createFormStore", () => {
  it("returns a plain object, not a class instance", () => {
    const store = createFormStore({ schema: userSchema, defaultValues: defaults });
    expect(Object.getPrototypeOf(store)).toBe(Object.prototype);
  });

  it("initializes with default values", () => {
    const store = createFormStore({ schema: userSchema, defaultValues: defaults });
    const state = store.getSnapshot();

    expect(state.values).toEqual(defaults);
    expect(state.errors).toEqual({});
    expect(state.isDirty).toBe(false);
    expect(state.isSubmitting).toBe(false);
  });

  describe("setValue / getFieldValue", () => {
    it("updates a field value", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      store.setValue("name", "あさひ");

      expect(store.getFieldValue("name")).toBe("あさひ");
      expect(store.getSnapshot().isDirty).toBe(true);
    });

    it("resets isDirty when value matches default", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      store.setValue("name", "あさひ");
      expect(store.getSnapshot().isDirty).toBe(true);

      store.setValue("name", "");
      expect(store.getSnapshot().isDirty).toBe(false);
    });
  });

  describe("validate", () => {
    it("returns null and sets errors on invalid data", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      const result = store.validate();

      expect(result).toBeNull();
      expect(store.getFieldError("name")).toBe("名前は必須です");
      expect(store.getFieldError("email")).toBe("メールアドレスの形式が不正です");
    });

    it("returns transformed output on valid data", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      store.setValue("name", "あさひ");
      store.setValue("email", "asahi@example.com");

      const result = store.validate();

      expect(result).toEqual({ name: "あさひ", email: "asahi@example.com" });
    });

    it("clears errors on successful validation", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      // まず失敗
      store.validate();
      expect(store.getFieldError("name")).toBeDefined();

      // 値をセットして再バリデーション
      store.setValue("name", "あさひ");
      store.setValue("email", "asahi@example.com");
      store.validate();

      expect(store.getFieldError("name")).toBeUndefined();
      expect(store.getFieldError("email")).toBeUndefined();
    });
  });

  describe("Zod refine (cross-field validation)", () => {
    const passwordSchema = z
      .object({
        password: z.string().min(8, "8文字以上"),
        confirm: z.string(),
      })
      .refine((d) => d.password === d.confirm, {
        path: ["confirm"],
        message: "パスワードが一致しません",
      });

    it("shows refine errors on the correct field", () => {
      const store = createFormStore({
        schema: passwordSchema,
        defaultValues: { password: "12345678", confirm: "different" },
      });

      const result = store.validate();

      expect(result).toBeNull();
      expect(store.getFieldError("confirm")).toBe("パスワードが一致しません");
    });

    it("passes when refine condition is met", () => {
      const store = createFormStore({
        schema: passwordSchema,
        defaultValues: { password: "12345678", confirm: "12345678" },
      });

      const result = store.validate();

      expect(result).toEqual({ password: "12345678", confirm: "12345678" });
    });
  });

  describe("Zod transform", () => {
    const transformSchema = z.object({
      tags: z.string().transform((v) => v.split(",").map((s) => s.trim())),
    });

    it("returns transformed output on validate", () => {
      const store = createFormStore({
        schema: transformSchema,
        defaultValues: { tags: "react, zod, orbit" },
      });

      const result = store.validate();

      expect(result).toEqual({ tags: ["react", "zod", "orbit"] });
    });
  });

  describe("touched / validateField", () => {
    it("tracks touched state", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      expect(store.getFieldTouched("name")).toBe(false);

      store.setTouched("name");
      expect(store.getFieldTouched("name")).toBe(true);
    });

    it("validates a single field on blur", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      store.validateField("name");

      expect(store.getFieldError("name")).toBe("名前は必須です");
      // 他のフィールドはエラーなし（まだ触ってない）
      expect(store.getFieldError("email")).toBeUndefined();
    });
  });

  describe("reset", () => {
    it("resets a single field to default", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      store.setValue("name", "あさひ");
      store.setTouched("name");

      store.reset("name");

      expect(store.getFieldValue("name")).toBe("");
      expect(store.getFieldTouched("name")).toBe(false);
    });

    it("resets all fields", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      store.setValue("name", "あさひ");
      store.setValue("email", "asahi@example.com");

      store.resetAll();

      expect(store.getSnapshot().values).toEqual(defaults);
      expect(store.getSnapshot().isDirty).toBe(false);
    });

    it("resets all fields with new values", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      const newValues: UserInput = {
        name: "ずんだもん",
        email: "zunda@example.com",
        age: undefined,
      };
      store.resetAll(newValues);

      expect(store.getSnapshot().values).toEqual(newValues);
    });
  });

  describe("subscribe / notify", () => {
    it("notifies global subscribers on setValue", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });
      const callback = vi.fn();

      store.subscribe(callback);
      store.setValue("name", "あさひ");

      expect(callback).toHaveBeenCalled();
    });

    it("notifies field subscribers on setValue", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });
      const nameCallback = vi.fn();
      const emailCallback = vi.fn();

      store.subscribeField("name", nameCallback);
      store.subscribeField("email", emailCallback);

      store.setValue("name", "あさひ");

      expect(nameCallback).toHaveBeenCalled();
      expect(emailCallback).not.toHaveBeenCalled();
    });

    it("unsubscribe stops notifications", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });
      const callback = vi.fn();

      const unsub = store.subscribe(callback);
      unsub();

      store.setValue("name", "あさひ");

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("getFieldSnapshot", () => {
    it("returns stable snapshot for unchanged field", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      const snap1 = store.getFieldSnapshot("name");
      const snap2 = store.getFieldSnapshot("name");

      expect(snap1).toBe(snap2); // 同一参照
    });

    it("returns new snapshot after field change", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      const snap1 = store.getFieldSnapshot("name");
      store.setValue("name", "あさひ");
      const snap2 = store.getFieldSnapshot("name");

      expect(snap1).not.toBe(snap2);
      expect(snap2.value).toBe("あさひ");
    });
  });

  describe("dependencies", () => {
    it("runs dependency callback when source field changes", () => {
      const dep = vi.fn();
      const store = createFormStore({
        schema: userSchema,
        defaultValues: defaults,
        dependencies: { name: dep },
      });

      store.setValue("name", "あさひ");

      expect(dep).toHaveBeenCalledWith(
        "あさひ",
        expect.objectContaining({
          reset: expect.any(Function),
          setValue: expect.any(Function),
        }),
      );
    });

    it("dependency can reset another field", () => {
      const store = createFormStore({
        schema: z.object({
          category: z.string(),
          subcategory: z.string(),
        }),
        defaultValues: { category: "food", subcategory: "ramen" },
        dependencies: {
          category: (_value, form) => {
            form.reset("subcategory");
          },
        },
      });

      store.setValue("subcategory", "sushi");
      expect(store.getFieldValue("subcategory")).toBe("sushi");

      // category を変更 → subcategory がリセットされる
      store.setValue("category", "drink");
      expect(store.getFieldValue("subcategory")).toBe("ramen");
    });

    it("dependency can set another field value", () => {
      const store = createFormStore({
        schema: z.object({
          percentMode: z.boolean(),
          displayUnit: z.string(),
        }),
        defaultValues: { percentMode: false, displayUnit: "件" },
        dependencies: {
          percentMode: (value, form) => {
            form.setValue("displayUnit", value ? "%" : "件");
          },
        },
      });

      store.setValue("percentMode", true);
      expect(store.getFieldValue("displayUnit")).toBe("%");

      store.setValue("percentMode", false);
      expect(store.getFieldValue("displayUnit")).toBe("件");
    });

    it("dependency reset clears stale error on touched target field", () => {
      const store = createFormStore({
        schema: z.object({
          category: z.string(),
          subcategory: z.string().min(1, "必須です"),
        }),
        defaultValues: { category: "food", subcategory: "" },
        dependencies: {
          category: (_value, form) => {
            form.reset("subcategory");
          },
        },
      });

      // subcategory を touch してバリデーションエラーを出す
      store.setTouched("subcategory");
      store.validateField("subcategory");
      expect(store.getFieldError("subcategory")).toBe("必須です");

      // subcategory に値を入れてエラー解消
      store.setValue("subcategory", "ramen");
      expect(store.getFieldError("subcategory")).toBeUndefined();

      // category を変更 → subcategory がリセット（空文字に戻る）
      // touched なのでエラーが再表示されるべき
      store.setValue("category", "drink");
      expect(store.getFieldValue("subcategory")).toBe("");
      expect(store.getFieldError("subcategory")).toBe("必須です");
    });

    it("dependency setValue clears error when new value is valid", () => {
      const store = createFormStore({
        schema: z.object({
          percentMode: z.boolean(),
          displayUnit: z.string().min(1, "必須です"),
        }),
        defaultValues: { percentMode: false, displayUnit: "" },
        dependencies: {
          percentMode: (value, form) => {
            form.setValue("displayUnit", value ? "%" : "件");
          },
        },
      });

      // displayUnit を touch してエラーを出す
      store.setTouched("displayUnit");
      store.validateField("displayUnit");
      expect(store.getFieldError("displayUnit")).toBe("必須です");

      // percentMode を変更 → displayUnit が "%" にセットされエラー解消
      store.setValue("percentMode", true);
      expect(store.getFieldValue("displayUnit")).toBe("%");
      expect(store.getFieldError("displayUnit")).toBeUndefined();
    });
  });

  describe("isSubmitting", () => {
    it("tracks submitting state", () => {
      const store = createFormStore({ schema: userSchema, defaultValues: defaults });

      expect(store.getSnapshot().isSubmitting).toBe(false);

      store.setSubmitting(true);
      expect(store.getSnapshot().isSubmitting).toBe(true);

      store.setSubmitting(false);
      expect(store.getSnapshot().isSubmitting).toBe(false);
    });
  });
});
