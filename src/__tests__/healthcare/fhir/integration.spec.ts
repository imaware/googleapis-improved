import { R4 } from "@imaware/ts-fhir-types";
import { google, healthcare_v1 } from "googleapis";
import { GaxiosPromise } from "googleapis/build/src/apis/abusiveexperiencereport";
import { patientGenerator } from '@imaware/fhir-gen';
import fhirSearch from "../../../healthcare/fhir/search";
import { GaxiosError } from "gaxios";

/**
 * Wraps Gaxios promises with an error handler that translates errors into HttpErrors
 * and debug logs responses.
 *
 * @param {GaxiosPromise<T>} promise - A GaxiosPromise of type T.
 * @returns {GaxiosPromise<T>} - The provided GaxiosPromise, but with HttpErrors
 */
export const wrapGaxiosPromise = async <T>(promise: GaxiosPromise<T>): GaxiosPromise<T> =>
 promise.catch((e: GaxiosError) => {
   throw new Error(`GaxiosError: [${e.code}] ${e.response?.statusText}`);
 });
const healthcare = google.healthcare('v1');

const setup = async (): Promise<void> => {
  const auth = await google.auth.getClient({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  google.options({
    auth,
    headers: { 'Content-Type': 'application/fhir+json' },
  });
  console.info('GCP auth initialized');
};
/**
 * Creates a temporary FHIRstore for testing
 *
 * @param parent - The name of the dataset where the FHIRstore will be created in
 * @param fhirStoreId - The id of the temporary FHIRstore
 *
 * @returns A promise with the result of the create operation
 */
 export const createTempFhirStore = async (
    parent: string,
    fhirStoreId: string
  ): GaxiosPromise<healthcare_v1.Schema$FhirStore> => {
    try {
      // Create temp FHIR store
      await healthcare.projects.locations.datasets.fhirStores.create({
        parent,
        fhirStoreId,
        requestBody: {
          enableUpdateCreate: true,
          version: 'R4',
        },
      });
      console.info(`created test FHIR store: ${parent}`);
  
      // Verify store creation
      const tempFhirStore = await healthcare.projects.locations.datasets.fhirStores
        .get({ name: parent });
      console.info(`verified test FHIR store: ${parent}`);
      return tempFhirStore;
    } catch (e: any) {
      console.error('error loading test data', JSON.stringify(e.message, null, 2));
      throw e;
    }
  };

describe('search', () => {
    jest.setTimeout(60000);
    const defaultOpts = { maxPages: -1, maxPerPage: 1000, strict: true };
    const deleteFhirStore = process.env.CLEAN_DATA === '1';
    const createData = process.env.CREATE_DATA === '1';
    const parent = `projects/${process.env.GCP_PROJECT}/locations/${process.env.GCP_REGION}/datasets/${process.env.TEST_FHIR_DATASET}/fhirStores/${process.env.TEST_FHIR_STORE_ID}`;
    let testPatients = patientGenerator(5000, { active: true });
    beforeAll(async () => {
        await setup();
        if (!createData) {
            return;
        }
        await wrapGaxiosPromise(createTempFhirStore(`projects/${process.env.GCP_PROJECT}/locations/${process.env.GCP_REGION}/datasets/${process.env.TEST_FHIR_DATASET}`, process.env.TEST_FHIR_STORE_ID ?? ''));
        console.info(`created ${parent}`);
        testPatients = testPatients.map((patient: R4.IPatient, index: number) => {
            // Mark every 50th patient inactive
            if (index % 50 === 0) {
                patient.active = false;
            }
            // Mark every 100th patient as deceased
            if (index % 100 === 0) {
                patient.deceasedDateTime = new Date().toISOString();
            }
            return patient;
        });
        const bundles = [] as R4.IBundle[];
        const chunkSize = 1000;
        for (let i = 0; i < testPatients.length; i += chunkSize) {
            bundles.push({
                resourceType: 'Bundle',
                type: R4.BundleTypeKind._transaction,
                entry: testPatients.slice(i, i + chunkSize).map(patient => ({
                    resource: patient,
                    request: {
                        method: R4.Bundle_RequestMethodKind._put,
                        url: `Patient/${patient.id}`,
                    },
                })),
            });
        }
        console.info(`bundle lengths: ${bundles.map(b => b.entry?.length).join(', ')}`);
        await Promise.all(bundles.map((bundle: R4.IBundle) => wrapGaxiosPromise(healthcare.projects.locations.datasets.fhirStores.fhir.executeBundle({ parent, requestBody: bundle } as healthcare_v1.Params$Resource$Projects$Locations$Datasets$Fhirstores$Fhir$Executebundle))));
        console.info('loaded test data');
    });
    afterAll(async () => {
        if (!deleteFhirStore) {
            console.info('skipping delete of test FHIR store');
            return;
        }
        await wrapGaxiosPromise(healthcare.projects.locations.datasets.fhirStores.delete({ name: parent }));
        console.info(`deleted ${parent}`);
    });
    it('should be able to find all patients', async () => {
        const bundle = await fhirSearch(`${parent}/fhir/Patient`, [], defaultOpts);
        console.info(bundle.entry?.length);
        expect(bundle.entry?.length).toBe(testPatients.length);
    });
    it('should be able to find all active patients', async () => {
        const bundle = await fhirSearch(`${parent}/fhir/Patient`, [['active', 'true']], defaultOpts);
        console.info(bundle.entry?.length);
        expect(bundle.entry?.length).toBe(testPatients.length-(testPatients.length/50));
    });
    it('should be able to find all deceased patients', async () => {
        const bundle = await fhirSearch(`${parent}/fhir/Patient`, [['death-date:missing', 'false']], defaultOpts);
        console.info(bundle.entry?.length);
        expect(bundle.entry?.length).toBe(testPatients.length/100);
    });
    it('should fail to all patients when strict search is off given bad search params', async () => {
        const bundle = await fhirSearch(`${parent}/fhir/Patient`, [['foo', 'bar']], { ...defaultOpts, strict: false });
        console.info(bundle);
        expect(bundle.entry?.length).toBe(testPatients.length);
    });
});