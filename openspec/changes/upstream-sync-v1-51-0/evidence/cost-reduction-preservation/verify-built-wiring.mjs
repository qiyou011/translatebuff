import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"

// Reuse the already installed, lockfile-pinned parser; add no dependency.
const require = createRequire(import.meta.url)
const {
  parse,
} = require("../../../../../node_modules/.pnpm/acorn@8.17.0/node_modules/acorn/dist/acorn.js")
const file = process.argv[2]
const output = process.argv[3]
assert.ok(file && output)
const source = readFileSync(file, "utf8")
function nodes(root) {
  const all = []
  function walk(node) {
    if (!node || typeof node !== "object") return
    all.push(node)
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value?.type) walk(value)
    }
  }
  walk(root)
  return all
}
const literal = (node) =>
  node?.type === "TemplateLiteral" && node.expressions.length === 0
    ? node.quasis[0].value.cooked
    : node?.value
const all = nodes(parse(source, { ecmaVersion: "latest", sourceType: "module" }))
const functions = all.filter((node) => node.type === "FunctionDeclaration")
const code = (node) => source.slice(node.start, node.end)
const factories = functions.filter((node) =>
  ["interactionQueue", "isScopeCancelled", "batchQueue"].every((key) => code(node).includes(key)),
)
assert.equal(factories.length, 1)
const factory = factories[0]
const setups = functions.filter((node) => code(node).includes("enqueueTranslateRequest"))
assert.equal(setups.length, 1)
const setup = setups[0]
const init = setup.body.body[0].declarations[0].init
assert.equal(init.type, "CallExpression")
assert.equal(init.arguments[0].name, setup.params[0].name)
const loader = functions.find((node) => node.id.name === init.callee.name)
assert.ok(loader)
const forkObjects = nodes(loader).filter(
  (node) =>
    node.type === "ObjectExpression" &&
    node.properties.some(
      (property) => property.key?.name === "kind" && literal(property.value) === "fork",
    ),
)
assert.equal(forkObjects.length, 1)
const spread = forkObjects[0].properties.find((property) => property.type === "SpreadElement")
assert.equal(spread.argument.type, "CallExpression")
assert.equal(spread.argument.callee.name, loader.params[0].name)
const main = all.find(
  (node) =>
    node.type === "Property" &&
    node.key?.name === "main" &&
    nodes(node.value).some(
      (call) =>
        call.type === "CallExpression" &&
        call.callee.name === setup.id.name &&
        call.arguments[0]?.name === factory.id.name,
    ),
)
assert.ok(main, "Built main must pass the actual fork queue factory")
const queues = nodes(factory).filter(
  (node) =>
    node.type === "NewExpression" &&
    node.arguments[0]?.type === "ObjectExpression" &&
    node.arguments[0].properties.some(
      (property) => property.key?.name === "timeoutMs" && literal(property.value) === 20000,
    ),
)
assert.equal(queues.length, 2)
const limit = queues[0].arguments[0].properties.find(
  (property) => property.key?.name === "maxConcurrent",
)
assert.equal(limit.value.operator, "??")
assert.equal(literal(limit.value.right), 4)
assert.equal(
  queues[1].arguments[0].properties.some((property) => property.key?.name === "maxConcurrent"),
  false,
)
assert.ok(
  all.some(
    (node) =>
      node.type === "ObjectExpression" &&
      node.properties.some(
        (property) => property.key?.name === "maxItemsPerBatch" && literal(property.value) === 16,
      ) &&
      node.properties.some(
        (property) =>
          property.key?.name === "maxCharactersPerBatch" && literal(property.value) === 4000,
      ),
  ),
)
const result = {
  status: "PASS",
  kind: "Compiled AST static wiring, not live service-worker execution",
  bundle: file,
  sha256: createHash("sha256").update(source).digest("hex"),
  compiledNames: { setup: setup.id.name, loader: loader.id.name, factory: factory.id.name },
  mainPassesForkFactory: true,
  setupForwardsFactoryToLoader: true,
  loaderUsesFactoryInForkBranch: true,
  pageAndInteractionQueuesSeparate: true,
  pageMaxConcurrent: 4,
  interactionUsesPageConcurrencyLimit: false,
  defaultLlmBatchPair: [16, 4000],
}
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result))
