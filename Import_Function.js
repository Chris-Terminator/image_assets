// Loop over input items and add a new field called 'myNewField' to the JSON of each one
// n8n Code Node - Simplified (reads VF data from previous Set node)
// Much cleaner approach!

const items = $input.all();
const returnData = [];

// Get data from previous "Set VF Project Data" node
const prevNode = $('Set VF Project Data').first().json;
const projectData = prevNode.vfProjectData;
const authToken = prevNode.VF_AUTH_TOKEN;
const workspaceId = prevNode.VF_WORKSPACE_ID;

console.log('Project data keys:', Object.keys(projectData || {}));
console.log('Project name:', projectData?.project?.name || 'Unknown');
console.log('Auth token length:', authToken?.length || 0);
console.log('Workspace ID:', workspaceId);

// Validation
if (!projectData) {
  throw new Error('No VF project data found in previous node');
}

if (!authToken || authToken.length < 50) {
  throw new Error('Invalid or missing VF_AUTH_TOKEN');
}

/**
 * Universal HTTP request for different n8n versions
 */
async function makeHttpRequest(options) {
  const methods = [
    () => $request(options),
    () => this.helpers.httpRequest(options),
    () => $http.request(options),
    () => fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body
    }).then(r => r.json())
  ];
  
  for (const method of methods) {
    try {
      return await method();
    } catch (error) {
      continue;
    }
  }
  
  throw new Error('No HTTP method available in this n8n environment');
}

/**
 * Import VoiceFlow project
 */
async function importProject(vfData, fileName) {
  const boundary = `----WebKitFormBoundary${Math.random().toString(16).substr(2)}`;
  const vfContent = JSON.stringify(vfData);
  
  console.log(`Creating import for: ${fileName}`);
  console.log(`Content size: ${vfContent.length} characters`);
  
  // Build exact multipart body structure
  let body = `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
  body += `Content-Type: application/octet-stream\r\n\r\n`;
  body += vfContent;
  body += `\r\n--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="targetSchemaVersion"\r\n\r\n`;
  body += `13.03\r\n`;
  body += `--${boundary}--\r\n`;
  
  const options = {
    method: 'POST',
    url: `https://realtime-api.voiceflow.com/v1alpha1/assistant/import-file/${workspaceId}`,
    headers: {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'authorization': `Bearer ${authToken}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'origin': 'https://creator.voiceflow.com',
      'referer': 'https://creator.voiceflow.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: body
  };
  
  console.log(`Request URL: ${options.url}`);
  console.log(`Request boundary: ${boundary}`);
  
  return await makeHttpRequest(options);
}

// Import the project
try {
  const fileName = `${projectData.project?.name || 'VF-Project'}-${Date.now()}.vf`;
  
  console.log(`\n=== Starting Import ===`);
  console.log(`File: ${fileName}`);
  
  const response = await importProject(projectData, fileName);
  
  console.log(`✅ Import successful!`);
  console.log(`Response:`, JSON.stringify(response, null, 2));
  
  returnData.push({
    json: {
      success: true,
      fileName: fileName,
      projectName: projectData.project?.name || 'Unknown',
      projectId: response?.id || null,
      response: response,
      timestamp: new Date().toISOString()
    }
  });
  
} catch (error) {
  console.error(`❌ Import failed:`, error.message);
  console.error(`Full error:`, error);
  
  returnData.push({
    json: {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }
  });
}

console.log(`\n=== Import Complete ===`);
return returnData;
