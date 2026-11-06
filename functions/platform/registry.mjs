import definitions from "./contract.json" with { type: "json" };
export const definitionsById = new Map(
  definitions.map((d) => [d.operationId, d]),
);
export const platformRoutes = definitions.map((d) => [
  d.method,
  d.path,
  d.operationId,
  d.scope,
  "platform",
  null,
  d.versionKind,
]);
export const platformScopes = [
  ...new Set(definitions.flatMap((d) => d.scopes || [d.scope])),
];
export { definitions };
