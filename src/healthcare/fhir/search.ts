import { R4 } from "@imaware/ts-fhir-types";
import axios from "axios";
import { google } from "googleapis";
import * as E from 'fp-ts/lib/Either';

interface IParams {
    [key: string]: string;
}

interface FhirSearchOpts {
    maxPerPage: number;
    maxPages: number;
    strict: boolean;
    link?: string;
}

/**
 * GCP Healthcare API FHIR search
 * @param {string} resourceTypeUri - FHIR server url (e.g. projects/my-project/locations/us-central1/datasets/my-dataset/fhirStores/my-fhir-store/fhir/Patient)
 * @param {string} fhirSearchParams - FHIR search query parameters (e.g. ['key', 'value'])
 * @param {FhirSearchOpts} opts - Search options
 * 
 * @returns {Promise<R4.Bundle>}
 */
const fhirSearch = async (resourceTypeUri: string, fhirSearchParams: [string, string][], opts: FhirSearchOpts = { maxPages: -1, maxPerPage: 1000, strict: false }): Promise<R4.IBundle> => {
    console.debug(`calling fhirSearch: ${resourceTypeUri} - ${fhirSearchParams} - ${JSON.stringify(opts)}`);
    const { maxPages, maxPerPage, strict, link } = opts;
    const params = {} as IParams;
    // Build the search parameters
    fhirSearchParams.forEach(([key, value]) => {
      params[key] = value;
    });
    // Pagination
    params['_count'] = maxPerPage.toString();
    const token = await google.auth.getAccessToken();
    // Perform search either with a link or with the search parameters
    const res = await axios.get<R4.IBundle>(link ? link : `https://healthcare.googleapis.com/v1/${resourceTypeUri}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(strict && { Prefer: 'strict' }),
      },
      ...(!link && { params }),
    });
    const validationResult = R4.RTTI_Bundle.decode(res.data);
    if (E.isRight(validationResult)) {
      const bundle: R4.IBundle = validationResult.right;
      // If no results, return the bundle
      if (!bundle.entry || bundle.entry?.length === 0) {
        return bundle;
      }
      // Check for next page
      const nextPage = bundle.link?.find((link: R4.IBundle_Link) => link.relation === 'next');
      // If we have a next page, recursively call this function
      if (nextPage?.url && maxPages !== 0) {
        const nextBundle = await fhirSearch(resourceTypeUri, fhirSearchParams, { maxPages: maxPages - 1, maxPerPage, strict, link: nextPage.url });
        // Merge the results
        if (nextBundle.entry) {
           bundle.entry = bundle.entry.concat(nextBundle.entry);
        }
      }
      // Return the bundle
      return bundle;
    } else {
      throw new Error('unable to decode resource into Bundle type');
    }
};
export default fhirSearch;