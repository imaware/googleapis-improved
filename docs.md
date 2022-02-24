<a name="fhirSearch"></a>

## fhirSearch(resourceTypeUri, fhirSearchParams, opts) ⇒ <code>Promise.&lt;R4.Bundle&gt;</code>

<p>GCP Healthcare API FHIR search</p>

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| resourceTypeUri | <code>string</code> | <p>FHIR server url (e.g. projects/my-project/locations/us-central1/datasets/my-dataset/fhirStores/my-fhir-store/fhir/Patient)</p> |
| fhirSearchParams | <code>string</code> | <p>FHIR search query parameters (e.g. ['key', 'value'])</p> |
| opts | <code>FhirSearchOpts</code> | <p>Search options</p> |
