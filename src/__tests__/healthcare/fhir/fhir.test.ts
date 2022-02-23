import {patientGenerator} from '@imaware/fhir-gen';
import http from 'http';
import url from 'url';

const oldEnv = process.env;
process.env.GCP_HEALTHCARE_API_BASE_URL = 'http://localhost:8080';

jest.mock('googleapis');

describe('fhir', () => {
  let server: http.Server;
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      console.log(`${req.method} ${req.url}`);
      if (req.url?.includes('/Patient')) {
        const query = url.parse(req.url, true).search;
        expect(query).toBe('?key=value1&key=value2&_count=1000');
        res.writeHead(200, {'Content-Type': 'application/json'});
        return res.end(
          JSON.stringify({
            resourceType: 'Bundle',
            type: 'searchset',
            entry: patientGenerator(2),
          }),
        );
      }
      res.write('{}');
      res.end();
    });
    server.listen(8080);
  });
  afterAll(done => {
    process.env = oldEnv;
    server.close(done);
  });
  // When given duplicate keys for search parameters, it should add both to the query
  it('should add both search parameters to the query', async () => {
    const fhirSearch = (await import('../../../healthcare/fhir/search'))
      .default;
    const resourceTypeUri =
      'projects/my-project/locations/us-central1/datasets/my-dataset/fhirStores/my-fhir-store/fhir/Patient';
    const fhirSearchParams = [
      ['key', 'value1'],
      ['key', 'value2'],
    ] as [string, string][];
    const opts = {
      maxPages: -1,
      maxPerPage: 1000,
      strict: false,
    };
    await fhirSearch(resourceTypeUri, fhirSearchParams, opts);
  });
});
