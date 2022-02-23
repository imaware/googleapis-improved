export * from './fhir';

export const healthcareApiBaseUrl =
  process.env.GCP_HEALTHCARE_API_BASE_URL ??
  'https://healthcare.googleapis.com/v1';
