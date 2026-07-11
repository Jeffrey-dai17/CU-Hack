const assert = require("node:assert/strict");
const test = require("node:test");

const geminiModulePath = require.resolve("../src/services/geminiService");
const googleModulePath = require.resolve("@google/generative-ai");

function clearGeminiService() {
  delete require.cache[geminiModulePath];
}

test.afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  clearGeminiService();
  delete require.cache[googleModulePath];
});

test("parseGoal returns empty object when GEMINI_API_KEY is missing", async () => {
  delete process.env.GEMINI_API_KEY;
  clearGeminiService();

  const { parseGoal } = require("../src/services/geminiService");

  assert.deepEqual(await parseGoal("vegan under 600 calories"), {});
});

test("parseGoal sends the strict few-shot prompt and parses fenced JSON defensively", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  let capturedModel;
  let capturedPrompt;

  require.cache[googleModulePath] = {
    id: googleModulePath,
    filename: googleModulePath,
    loaded: true,
    exports: {
      GoogleGenerativeAI: class {
        constructor(apiKey) {
          assert.equal(apiKey, "test-key");
        }

        getGenerativeModel(options) {
          capturedModel = options.model;
          return {
            async generateContent(prompt) {
              capturedPrompt = prompt;
              return {
                response: {
                  text: () => '```json\n{"diet":"vegan","maxReadyTime":30}\n```',
                },
              };
            },
          };
        }
      },
    },
  };
  clearGeminiService();

  const { parseGoal } = require("../src/services/geminiService");
  const parsed = await parseGoal('vegan "quick" meals');

  assert.equal(capturedModel, "gemini-2.0-flash");
  assert.match(capturedPrompt, /Output raw JSON only/);
  assert.match(
    capturedPrompt,
    /Input: "cutting carbs, high protein, something quick"\nOutput: \{"minProtein_g": 30, "maxReadyTime": 30\}/
  );
  assert.match(
    capturedPrompt,
    /Input: "vegan, no peanuts, under 600 calories"\nOutput: \{"diet": "vegan", "excludeIngredients": \["peanuts"\], "maxCalories": 600\}/
  );
  assert.match(capturedPrompt, /Input: "just something tasty"\nOutput: \{\}/);
  assert.match(
    capturedPrompt,
    /Input: "keto, dinner in under an hour"\nOutput: \{"diet": "ketogenic", "maxReadyTime": 60\}/
  );
  assert.match(capturedPrompt, /Input: "vegan \\"quick\\" meals"\nOutput:/);
  assert.deepEqual(parsed, { diet: "vegan", maxReadyTime: 30 });
});

test("parseGoal logs invalid model JSON and returns empty object", async (t) => {
  process.env.GEMINI_API_KEY = "test-key";
  t.mock.method(console, "error", () => {});

  require.cache[googleModulePath] = {
    id: googleModulePath,
    filename: googleModulePath,
    loaded: true,
    exports: {
      GoogleGenerativeAI: class {
        getGenerativeModel() {
          return {
            async generateContent() {
              return { response: { text: () => "not json" } };
            },
          };
        }
      },
    },
  };
  clearGeminiService();

  const { parseGoal } = require("../src/services/geminiService");

  assert.deepEqual(await parseGoal("rambling text"), {});
  assert.equal(console.error.mock.callCount(), 1);
});
