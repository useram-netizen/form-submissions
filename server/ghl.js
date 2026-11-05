import dns from 'node:dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Force IPv4 lookup first on Windows to avoid Cloudflare IPv6 connection timeouts
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const GHL_API_TOKEN = process.env.GHL_API_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

if (!GHL_API_TOKEN || !GHL_LOCATION_ID) {
  console.warn('[GHL] Warning: GHL_API_TOKEN or GHL_LOCATION_ID not set in .env!');
}

async function ghlFetch(endpoint, options = {}, retries = 2) {
  const url = `${GHL_API_BASE}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${GHL_API_TOKEN}`,
    Version: GHL_API_VERSION,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`GHL [${options.method || 'GET'}] ${endpoint} failed (${res.status}): ${errorText}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        console.warn(`[GHL Retry] ${endpoint} failed (attempt ${attempt}/${retries}): ${err.message}. Retrying in 1s...`);
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        throw err;
      }
    }
  }
}

// Canonical form definitions to map form names to pipelines
const FORM_MAP = [
  {
    key: 'internalFreeDay',
    nameMatch: 'internal',
    displayName: 'Internal - Free Day',
    pipelineMatch: 'Internal - Free Day Form Status',
  },
  {
    key: 'freeDay',
    nameMatch: 'free day',
    displayName: 'Free Day',
    pipelineMatch: 'Free Day Form Status',
  },
  {
    key: 'generalInquiry',
    nameMatch: 'general inquiry',
    displayName: 'General Inquiry',
    pipelineMatch: 'General Inquiry Form Status',
  },
  {
    key: 'trainingConsultation',
    nameMatch: 'training',
    displayName: 'Training',
    pipelineMatch: 'Training Consultation Form Status',
  },
  {
    key: 'groomingCalendar',
    nameMatch: 'grooming',
    displayName: 'Grooming Calendar',
    pipelineMatch: 'Grooming Calendar Form Status',
  },
  {
    key: 'feedback',
    nameMatch: 'feedback',
    displayName: 'Feedback',
    pipelineMatch: null,
  },
];

const IGNORED_KEYS = new Set([
  'formId',
  'location_id',
  'locationId',
  'sessionId',
  'eventData',
  'Timezone',
  'fieldsOriSequance',
  'submissionId',
  'signatureHash',
  'ip',
  'terms_and_conditions',
  'parentId',
  'parentName',
  'medium',
  'mediumId',
  'button',
  'header',
  'image',
  'divider',
  'spacer',
  'captcha',
]);

export async function fetchSubmissionsDashboard() {
  const t0 = Date.now();
  console.log(`\n======================================================`);
  console.log(`[CRM Fetch] Starting full sync for location: ${GHL_LOCATION_ID}`);

  // Step 1: Parallel fetch of forms, pipelines, custom fields, and first page of submissions
  console.log(`[CRM Step 1] Fetching forms, pipelines, custom fields, and page 1 of submissions...`);
  const [formsRes, pipelinesRes, customFieldsRes, subPage1] = await Promise.all([
    ghlFetch(`/forms/?locationId=${GHL_LOCATION_ID}&limit=100`).catch((err) => {
      console.error('[CRM Error] /forms/ failed:', err.message);
      return { forms: [] };
    }),
    ghlFetch(`/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`).catch((err) => {
      console.error('[CRM Error] /opportunities/pipelines failed:', err.message);
      return { pipelines: [] };
    }),
    ghlFetch(`/locations/${GHL_LOCATION_ID}/customFields`).catch((err) => {
      console.error('[CRM Error] /customFields failed:', err.message);
      return { customFields: [] };
    }),
    ghlFetch(`/forms/submissions?locationId=${GHL_LOCATION_ID}&startAt=2020-01-01&limit=100&page=1`),
  ]);

  const allSubmissions = [...(subPage1.submissions || [])];
  const totalInCrm = subPage1.meta?.total || allSubmissions.length;
  const totalPagesNeeded = Math.ceil(totalInCrm / 100);

  console.log(`[CRM Submissions] CRM reported all-time total: ${totalInCrm} submissions (${totalPagesNeeded} pages)`);

  // If there are more pages, fetch ALL remaining pages in parallel
  if (totalPagesNeeded > 1) {
    const remainingPageNumbers = [];
    for (let p = 2; p <= totalPagesNeeded; p++) {
      remainingPageNumbers.push(p);
    }
    console.log(`[CRM Submissions] Fetching remaining pages in parallel:`, remainingPageNumbers);
    const remainingPages = await Promise.all(
      remainingPageNumbers.map((p) =>
        ghlFetch(`/forms/submissions?locationId=${GHL_LOCATION_ID}&startAt=2020-01-01&limit=100&page=${p}`).catch((err) => {
          console.error(`[CRM Error] Failed to fetch page ${p}:`, err.message);
          return { submissions: [] };
        })
      )
    );
    for (const pRes of remainingPages) {
      if (pRes.submissions) allSubmissions.push(...pRes.submissions);
    }
  }

  console.log(`[CRM Step 1 Done] Total submissions fetched: ${allSubmissions.length} of ${totalInCrm} in ${Date.now() - t0}ms`);

  // Step 2: Build Custom Fields label map
  const fieldLabelMap = new Map();
  for (const field of customFieldsRes.customFields || []) {
    fieldLabelMap.set(field.id, field.name);
    if (field.fieldKey) fieldLabelMap.set(field.fieldKey, field.name);
  }

  // Step 3: Map pipelines and stages
  const pipelines = pipelinesRes.pipelines || [];
  const pipelineById = new Map();
  const stagesById = new Map();
  const statusPipelines = [];

  for (const p of pipelines) {
    pipelineById.set(p.id, p);
    for (const s of p.stages || []) {
      stagesById.set(s.id, { stageName: s.name, pipelineId: p.id, pipelineName: p.name });
    }
    if (p.name.toLowerCase().includes('status')) {
      statusPipelines.push(p);
    }
  }

  // Step 4: Parallel fetch of opportunities across all status pipelines
  console.log(`[CRM Step 2] Fetching opportunities across ${statusPipelines.length} status pipelines...`);
  const oppResults = await Promise.all(
    statusPipelines.map((p) =>
      ghlFetch(`/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${p.id}&limit=100`)
        .then((r) => ({ pipelineId: p.id, opps: r.opportunities || [] }))
        .catch((err) => {
          console.error(`[CRM Error] Opp search for pipeline ${p.name} failed:`, err.message);
          return { pipelineId: p.id, opps: [] };
        })
    )
  );

  let totalOpps = 0;
  // Key: contactId:pipelineId -> opp, and fallback contactId -> opp
  const oppsByContactAndPipeline = new Map();
  const oppsByContact = new Map();

  for (const res of oppResults) {
    totalOpps += res.opps.length;
    for (const opp of res.opps) {
      if (opp.contact?.id) {
        oppsByContactAndPipeline.set(`${opp.contact.id}:${res.pipelineId}`, opp);
        if (!oppsByContact.has(opp.contact.id)) {
          oppsByContact.set(opp.contact.id, opp);
        }
      }
    }
  }
  console.log(`[CRM Step 2 Done] Opportunities resolved: ${totalOpps} across pipelines in ${Date.now() - t0}ms`);

  // Step 5: Build form mapping
  const forms = formsRes.forms || [];
  const formById = new Map();
  for (const f of forms) {
    const fLower = (f.name || '').toLowerCase();
    const config = FORM_MAP.find((m) => fLower.includes(m.nameMatch)) || {
      key: f.id,
      displayName: f.name || 'Custom Form',
      pipelineMatch: null,
    };
    
    // Find matching pipeline for this form
    let matchedPipeline = null;
    if (config.pipelineMatch) {
      matchedPipeline = pipelines.find((p) => p.name.toLowerCase() === config.pipelineMatch.toLowerCase());
    }

    formById.set(f.id, {
      id: f.id,
      name: f.name || 'Unnamed Form',
      displayName: config.displayName,
      pipeline: matchedPipeline || null,
    });
  }

  // Step 6: Process and normalize all submissions
  const allServicesSet = new Set();
  const allStatusesSet = new Set();

  let matchedStatusesCount = 0;

  const normalizedSubmissions = allSubmissions.map((raw) => {
    const formInfo = formById.get(raw.formId) || {
      id: raw.formId,
      name: raw.form?.name || 'Custom Form',
      displayName: raw.form?.name || 'Custom Form',
      pipeline: null,
    };

    const others = raw.others || {};

    // Extract Contact Info
    const firstName = others.first_name || '';
    const lastName = others.last_name || '';
    const fullName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : (raw.name || 'Unknown');
    const email = raw.email || others.email || null;
    const phone = others.phone || raw.phone || null;

    // Extract Service
    let service = null;
    for (const [k, v] of Object.entries(others)) {
      const kLower = k.toLowerCase();
      const label = (fieldLabelMap.get(k) || '').toLowerCase();
      if ((kLower.includes('service') || label.includes('service')) && v && typeof v === 'string') {
        service = v.trim();
        break;
      }
    }
    if (service) allServicesSet.add(service);

    // Extract Fields for Drawer
    const fields = [];
    for (const [k, v] of Object.entries(others)) {
      if (IGNORED_KEYS.has(k)) continue;
      if (v === null || v === undefined || v === '') continue;
      const label = fieldLabelMap.get(k) || k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      fields.push({ key: k, label, value: val });
    }

    // Match Opportunity & Status
    let matchedOpp = null;
    if (formInfo.pipeline) {
      matchedOpp = oppsByContactAndPipeline.get(`${raw.contactId}:${formInfo.pipeline.id}`);
    }
    if (!matchedOpp && raw.contactId) {
      matchedOpp = oppsByContact.get(raw.contactId);
    }

    let statusValue = '—';
    let pipelineStageId = null;
    let opportunityId = matchedOpp?.id || null;
    let pipelineId = formInfo.pipeline?.id || matchedOpp?.pipelineId || null;

    if (matchedOpp && matchedOpp.pipelineStageId) {
      const stageInfo = stagesById.get(matchedOpp.pipelineStageId);
      if (stageInfo) {
        statusValue = stageInfo.stageName;
        pipelineStageId = matchedOpp.pipelineStageId;
        matchedStatusesCount++;
      }
    }

    // Fallback: check contact custom fields in others if present
    if (statusValue === '—') {
      for (const [k, v] of Object.entries(others)) {
        const fieldName = (fieldLabelMap.get(k) || '').toLowerCase();
        if (fieldName.includes('status') && typeof v === 'string' && v.trim()) {
          statusValue = v.trim();
          matchedStatusesCount++;
          break;
        }
      }
    }

    if (statusValue !== '—') {
      allStatusesSet.add(statusValue);
    }

    // Available stages for dropdown
    const availableStages = formInfo.pipeline?.stages || [];

    return {
      id: raw.id || raw.submissionId || Math.random().toString(36).substring(7),
      submissionId: raw.submissionId || raw.id,
      contactId: raw.contactId,
      submittedAt: raw.createdAt || raw.dateAdded || new Date().toISOString(),
      formId: raw.formId,
      formName: formInfo.name,
      formDisplayName: formInfo.displayName,
      contact: {
        name: fullName,
        email,
        phone,
      },
      service,
      status: statusValue,
      pipelineId,
      pipelineStageId,
      opportunityId,
      availableStages,
      fields,
    };
  });

  // Sort descending by submittedAt
  normalizedSubmissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const elapsed = Date.now() - t0;
  console.log(`[CRM Complete] Done in ${elapsed}ms! Processed ${normalizedSubmissions.length} submissions (${matchedStatusesCount} with status)`);
  console.log(`======================================================\n`);

  return {
    submissions: normalizedSubmissions,
    total: normalizedSubmissions.length,
    services: Array.from(allServicesSet).sort(),
    statuses: Array.from(allStatusesSet).sort(),
    forms: Array.from(new Set(normalizedSubmissions.map((s) => s.formDisplayName))).sort(),
    locationId: GHL_LOCATION_ID,
    elapsedMs: elapsed,
  };
}

export async function updateSubmissionStatus({ contactId, contactName, pipelineId, stageId, opportunityId }) {
  console.log(`[GHL Update Status] oppId=${opportunityId} pipelineId=${pipelineId} stageId=${stageId}`);

  if (opportunityId) {
    // Update existing opportunity
    const res = await ghlFetch(`/opportunities/${opportunityId}`, {
      method: 'PUT',
      body: JSON.stringify({
        pipelineStageId: stageId,
      }),
    });
    return { success: true, opportunityId, stageId, result: res };
  } else if (pipelineId && contactId) {
    // Create new opportunity if one didn't exist
    const res = await ghlFetch(`/opportunities/`, {
      method: 'POST',
      body: JSON.stringify({
        name: contactName || 'Form Submission Lead',
        pipelineId,
        pipelineStageId: stageId,
        locationId: GHL_LOCATION_ID,
        contactId,
      }),
    });
    return { success: true, opportunityId: res.opportunity?.id || null, stageId, result: res };
  } else {
    throw new Error('Cannot update status: missing opportunityId and (pipelineId + contactId)');
  }
}

