import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

async function run() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform']});
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const res = await fetch('https://us-central1-aiplatform.googleapis.com/v1/projects/rekvin-v0/locations/us-central1/publishers/google/models?pageSize=1000', {
    headers: { Authorization: 'Bearer ' + token.token }
  });
  interface VertexModelsResponse {
    models: Array<{ name: string }>;
  }
  const data = await res.json() as VertexModelsResponse;
  const names = data.models.map((m) => m.name.split('/').pop());
  console.log('Available Gemini 2 models in us-central1:');
  console.log(names.filter((n: string) => n.includes('gemini-2')));
}
run().catch(console.error);
