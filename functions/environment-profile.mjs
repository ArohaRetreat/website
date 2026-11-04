export function environmentProfile(name = "production") {
  if (!["production", "pre-prod"].includes(name))
    throw Error("INVALID_DEPLOYMENT_ENVIRONMENT");
  const preprod = name === "pre-prod";
  return Object.freeze({
    name,
    preprod,
    prefix: preprod ? "aroha_preprod_" : "aroha_",
    serviceSuffix: preprod ? "-pre-prod" : "",
    origin: preprod
      ? "https://aroha-retreat-preprod.web.app"
      : "https://aroharetreat.com",
    site: preprod ? "aroha-retreat-preprod" : "aroha-retreat",
    codebase: preprod ? "aroha-website-preprod" : "aroha-website",
  });
}
