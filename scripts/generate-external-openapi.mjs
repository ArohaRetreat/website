import {definitionsById} from '../functions/platform/registry.mjs';
import { readFile, writeFile } from "node:fs/promises";
import { routes } from "../functions/external/routes.mjs";
import { SCOPES, CONTRACT_VERSION } from "../functions/external/access.mjs";
const legacy = JSON.parse(
  await readFile(
    new URL("../functions/booking/contract.json", import.meta.url),
  ),
);
const schemas = {
  Error: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string" },
          requestId: { type: "string" },
          retryable: { type: "boolean" },
        },
        required: ["code", "requestId", "retryable"],
      },
    },
    required: ["error"],
  },
};
Object.assign(
  schemas,
  JSON.parse(
    await readFile(
      new URL("../functions/external/responses.json", import.meta.url),
    ),
  ),
);
Object.assign(schemas,JSON.parse(await readFile(new URL('../functions/platform/responses.json',import.meta.url))));
const responseNames = {
  getRuntime: "Runtime",
  getAvailability: "Availability",
  getCalendar: "Calendar",
  listReservations: "ReservationPage",
  getReservation: "Reservation",
  list_units: "UnitPage",
  get_units: "Unit",
  getPublishedContent: "PublishedContent",
  listCommunications: "CommunicationsPage",
  getMyProfile: "Profile",
  getReservationContact: "Contact",
};
const paths = {};
for (const [
  method,
  raw,
  operationId,
  scope,
  command,
  action,
  versionKind,
] of routes) {
  const definition=definitionsById.get(operationId);
  if(definition){
    const path=raw.replace(/:([a-z][A-Za-z0-9]*)/g,'{$1}');
    const names=[...raw.matchAll(/:([a-z][A-Za-z0-9]*)/g)].map(m=>m[1]);
    const parameters=names.map(name=>({in:'path',name,required:true,schema:definition.input.properties[name]}));
    if(method==='GET')for(const[name,schema]of Object.entries(definition.input.properties))if(!names.includes(name))parameters.push({in:'query',name,required:definition.input.required.includes(name),schema});
    if(method!=='GET')parameters.push({in:'header',name:'Idempotency-Key',required:true,schema:{type:'string',minLength:8,maxLength:100,pattern:'^[A-Za-z0-9-]+$'}});
    if(method!=='GET'&&definition.versionKind)parameters.push({in:'header',name:'If-Match',required:true,schema:{type:'string'},description:'Strong ETag for '+definition.versionKind+' returned by its read operation.'});
    const input=structuredClone(definition.input);for(const name of [...names,'expectedVersion'])delete input.properties[name];input.required=input.required.filter(name=>!names.includes(name)&&name!=='expectedVersion');
    const output=definition.output||'DomainResult';schemas.DomainResult||={type:'object'};
    const responses={[method==='POST'?201:200]:{description:'Authorized shared business result',content:{[definition.binary?'application/pdf':'application/json']:{schema:definition.binary?{type:'string',format:'binary'}:{$ref:'#/components/schemas/'+output}}}}};
    for(const status of [400,401,403,404,409,410,412,413,415,422,428,429,503,504])responses[status]={description:'Bounded API error',content:{'application/json':{schema:{$ref:'#/components/schemas/Error'}}}};
    const op={operationId,summary:operationId,description:definition.description,security:[{integrationToken:[]}],'x-required-scopes':definition.scopes||[scope],'x-shared-operation':operationId,'x-implementation-status':'implemented-source-not-deployment-evidence',parameters,responses};
    if(method!=='GET'&&Object.keys(input.properties).length){const schemaName=operationId+'Input';schemas[schemaName]=input;op.requestBody={required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/'+schemaName}}}};}
    paths[path]||={};paths[path][method.toLowerCase()]=op;continue;
  }
  const path = raw.replace(/:([a-z][A-Za-z0-9]*)/g, "{$1}");
  const parameters = [...raw.matchAll(/:([a-z][A-Za-z0-9]*)/g)].map((m) => ({
    in: "path",
    name: m[1],
    required: true,
    schema: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" },
  }));
  if (method !== "GET")
    parameters.push({
      in: "header",
      name: "Idempotency-Key",
      required: true,
      schema: {
        type: "string",
        minLength: 8,
        maxLength: 100,
        pattern: "^[A-Za-z0-9-]+$",
      },
    });
  if (versionKind)
    parameters.push({
      in: "header",
      name: "If-Match",
      required: true,
      schema: { type: "string" },
    });
  if (operationId === "getAvailability")
    for (const name of [
      "kind",
      "arrival",
      "departure",
      "adults",
      "childrenAges",
      "unitIds",
    ])
      parameters.push({
        in: "query",
        name,
        required: ["kind", "arrival", "departure", "adults"].includes(name),
        schema:
          name === "adults"
            ? { type: "integer", minimum: 1, maximum: 35 }
            : name === "childrenAges"
              ? {
                  type: "array",
                  maxItems: 100,
                  items: { type: "integer", minimum: 0, maximum: 9 },
                }
              : name === "unitIds"
                ? { type: "array", maxItems: 5, items: { type: "string" } }
                : { type: "string" },
      });
  if (operationId === "getCalendar")
    for (const name of ["arrival", "departure"])
      parameters.push({
        in: "query",
        name,
        required: true,
        schema: { type: "string", format: "date" },
      });
  if (["listReservations", "listCommunications"].includes(operationId))
    parameters.push(
      {
        in: "query",
        name: "limit",
        schema: { type: "integer", minimum: 1, maximum: 50, default: 25 },
      },
      {
        in: "query",
        name: "cursor",
        schema: { type: "string", maxLength: 2048 },
      },
    );
  const response = {
    description:
      "Authorized bounded projection; current domain field sets documented in external-v1.md. No implementation implied for absent paths.",
    content: { "application/json": { schema: { type: "object" } } },
  };
  const op = {
    operationId,
    summary: operationId,
    security: [{ integrationToken: [] }],
    "x-required-scopes": operationId === "getReservationContact" ? [scope,"reservations:read"] : [scope],
    "x-shared-operation": command || "read-projection",
    "x-implementation-status": "implemented-source-not-deployment-evidence",
    parameters,
    responses: { 200: response },
  };
  if (
    [
      "createReservation",
      "createQuote",
      "createMyProfile",
      "createPromotion",
      "createBlock",
    ].includes(operationId)
  )
    op.responses = { 201: response };
  for (const status of [
    400, 401, 403, 404, 409, 410, 412, 413, 415, 422, 428, 429, 503, 504,
  ])
    op.responses[status] = {
      description: "Bounded API error",
      content: {
        "application/json": { schema: { $ref: "#/components/schemas/Error" } },
      },
    };
  if (command) {
    const input = structuredClone(legacy[command]);
    for (const key of ["id", "expectedVersion", "action"])
      delete input.properties[key];
    input.required = (input.required || []).filter(
      (k) => !["id", "expectedVersion", "action"].includes(k),
    );
    if (command === "quote" || command === "change-quote")
      input.required = input.required.filter((k) => k !== "guests");
    if (action) {
      const allowed =
        action === "offer_event"
          ? ["amount", "holdHours"]
          : action === "assign_rooms"
            ? ["units"]
            : [];
      input.properties = Object.fromEntries(
        Object.entries(input.properties).filter(([k]) => allowed.includes(k)),
      );
      input.required = [];
    }
    if (method === "DELETE" && command === "booking-action") {
      input.properties = {
        reason: { type: "string", minLength: 1, maxLength: 500 },
      };
      input.required = ["reason"];
    }
    const name = operationId + "Input";
    schemas[name] = input;
    op.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/" + name },
        },
      },
    };
  }
  paths[path] ??= {};
  paths[path][method.toLowerCase()] = op;
}
await writeFile(
  new URL("../docs/api/external-v1.json", import.meta.url),
  JSON.stringify(
    {
      openapi: "3.1.0",
      info: {
        title: "Aroha external API",
        version: CONTRACT_VERSION,
        description:
          "Versioned scoped CRUD surface using shared website and Studio business rules. Financial records use immutable receipts and reversals; media archive and profile erasure preserve required history. Source status is separate from deployment evidence.",
      },
      servers: [
        { url: "https://aroharetreat.com/api/external/v1" },
        { url: "https://aroha-retreat-preprod.web.app/api/external/v1" },
      ],
      paths,
      components: {
        schemas,
        securitySchemes: {
          integrationToken: {
            type: "http",
            scheme: "bearer",
            description:
              "Revocable environment-bound scoped integration token, issued after existing verified Google sign-in. Not an OAuth token.",
          },
        },
      },
      "x-scopes": SCOPES,
    },
    null,
    2,
  ) + "\n",
);
// Google-authenticated grant management remains on the existing /api/v1 base.
await writeFile(
  new URL('../functions/external/token-contract.json', import.meta.url),
  JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Aroha integration token management',
    contractVersion: CONTRACT_VERSION,
    basePath: '/api/v1/integration-tokens',
    authentication: 'Verified Google Firebase ID token; integration credentials cannot mint other credentials.',
    $defs: {
      create: {
        type: 'object', additionalProperties: false, required: ['name', 'scopes'],
        properties: {
          name: {type:'string',minLength:2,maxLength:80},
          clientId: {type:'string',pattern:'^[a-f0-9-]{36}$'},
          scopes: {type:'array',minItems:1,maxItems:SCOPES.length,uniqueItems:true,items:{enum:SCOPES}},
          purpose: {enum:['integration','mcp-readonly','mcp'],default:'integration'},
          rowAccess: {enum:['own','all'],default:'own'},
          expiresInHours: {anyOf:[{type:'integer',minimum:1,maximum:168},{type:'null'}],default:24,description:'Explicit null means never expires. Omitted means 24 hours. Existing grants are unchanged.'},
        },
      },
      metadata: {
        type:'object',additionalProperties:false,
        required:['id','name','scopes','rowAccess','purpose','version','active','createdAt','expiresAt'],
        properties:{
          id:{type:'string',pattern:'^[a-f0-9]{32}$'},name:{type:'string'},clientId:{type:'string',pattern:'^[a-f0-9-]{36}$'},
          scopes:{type:'array',items:{enum:SCOPES}},rowAccess:{enum:['own','all']},purpose:{enum:['integration','mcp-readonly','mcp']},
          version:{type:'integer',minimum:1},active:{type:'boolean'},createdAt:{type:'integer',minimum:0},
          expiresAt:{type:['integer','null'],minimum:0,description:'Epoch milliseconds, or null for never expires. Revocation and live authorization still apply.'},
        },
      },
    },
  },null,2)+'\n',
);
