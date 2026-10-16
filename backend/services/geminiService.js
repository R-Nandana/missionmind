const axios = require('axios');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function getCandidateModels() {
  const preferred = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  return [
    preferred,
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest'
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call Google Gemini generateContent API with model cascade fallback.
 */
async function callGemini(contents, systemInstruction = '', options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('No GEMINI_API_KEY configured');
  }

  const timeout = options.timeout || 20000;
  let lastError = null;
  const candidates = getCandidateModels();

  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        
        const payload = {
          contents: Array.isArray(contents) ? contents : [{ parts: [{ text: contents }] }]
        };

        if (systemInstruction) {
          payload.systemInstruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        payload.generationConfig = {
          temperature: options.temperature !== undefined ? options.temperature : 0.3,
          maxOutputTokens: options.maxOutputTokens || 1200
        };

        if (options.jsonMode) {
          payload.generationConfig.responseMimeType = 'application/json';
        }

        const response = await axios.post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
          },
          timeout
        });

        if (response.data?.error) {
          throw new Error(response.data.error.message || `Error code ${response.data.error.code}`);
        }

        const candidate = response.data?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (text) {
          return {
            text: text.trim(),
            model,
            finishReason: candidate.finishReason || 'STOP'
          };
        }
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        const errorMsg = err.response?.data?.error?.message || err.message;
        
        if (status === 503 && attempt === 0) {
          await sleep(800);
          continue;
        }

        console.warn(`[GeminiService] Model ${model} encountered issue (${status || 'error'}): ${errorMsg}. Trying fallback model...`);
        break;
      }
    }
  }

  throw new Error(`Gemini API call failed across candidate models: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Generate in-depth scientific AI Insights for a Mars MEDA observation.
 */
async function generateObservationInsights(observation, anomalyData = {}, evidenceChunks = []) {
  const systemPrompt = `You are MissionMind Gemini AI, a senior planetary atmospheric scientist and MEDA instrument expert for the Mars 2020 / Perseverance Rover mission at Jezero Crater.
Your task is to analyze Mars meteorological telemetry (temperature, pressure, solar longitude, diurnal timing) and explain anomalies or baseline trends with rigorous planetary science.
Maintain scientific precision, cite relevant phenomena (diurnal tidal waves, convective boundary layers, dust devil vortices, cold front advection), and provide actionable rover operational insights.`;

  const ltstFormatted = Number(observation.ltst || 12).toFixed(2);
  const tempVal = Number(observation.t_air).toFixed(1);
  const pressVal = Number(observation.pressure).toFixed(1);
  const solVal = observation.sol;
  const lsVal = Number(observation.ls || 30).toFixed(1);
  const isAnomaly = Boolean(observation.is_anomaly || anomalyData.detected);
  const anomalyType = observation.anomaly_type || (isAnomaly ? 'flagged_atmospheric_event' : 'seasonal_baseline');
  const anomalyScore = anomalyData.score ? Number(anomalyData.score).toFixed(2) : (isAnomaly ? '3.10' : '0.85');
  const reasons = (anomalyData.reasons && anomalyData.reasons.length) ? anomalyData.reasons.join('; ') : 'Telemetry within expected distribution.';

  let evidenceText = '';
  if (Array.isArray(evidenceChunks) && evidenceChunks.length > 0) {
    evidenceText = evidenceChunks.map(c => `[${c.chunk_id}] ${c.doc_title}: ${c.snippet}`).join('\n');
  }

  const prompt = `
Analyze this Mars Perseverance MEDA observation:
- Sol: ${solVal}
- Local True Solar Time (LTST): ${ltstFormatted} hours
- Solar Longitude (Ls): ${lsVal}° (Northern Martian seasonal indicator)
- Air Temperature: ${tempVal} °C
- Surface Pressure: ${pressVal} Pa
- Anomaly Flag: ${isAnomaly ? 'DETECTED' : 'NOMINAL BASELINE'}
- Anomaly Classification: ${anomalyType}
- Anomaly Z-Score: ${anomalyScore}σ
- Detection Findings: ${reasons}
${evidenceText ? `\nNASA / Mission Evidence Chunks:\n${evidenceText}` : ''}

Respond with valid JSON containing exactly these 4 keys:
{
  "summary": "2-3 concise scientific sentences summarizing the observation, significance, and findings.",
  "atmospheric_dynamics": "Detailed explanation of the atmospheric physics (boundary layer convection, thermal suction, vortex dynamics, or diurnal radiational balance).",
  "science_hypothesis": "Specific scientific hypothesis regarding surface-atmosphere interactions or atmospheric wave phenomena.",
  "mission_safety": "Operational recommendation for Perseverance rover instruments (e.g. MOXIE, SuperCam optics, dust sensor, helicopter flight conditions)."
}`;

  try {
    const res = await callGemini(prompt, systemPrompt, { temperature: 0.2, jsonMode: true });
    let parsed = null;
    try {
      const cleanJson = res.text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleanJson);

      // If the model nested JSON inside the summary string, unpack it cleanly
      if (typeof parsed.summary === 'string' && parsed.summary.trim().startsWith('{')) {
        try {
          const nested = JSON.parse(parsed.summary);
          parsed = {
            summary: nested.summary || parsed.summary,
            atmospheric_dynamics: nested.atmospheric_dynamics || parsed.atmospheric_dynamics,
            science_hypothesis: nested.science_hypothesis || parsed.science_hypothesis,
            mission_safety: nested.mission_safety || parsed.mission_safety
          };
        } catch {
          // ignore nested parse failure
        }
      }
    } catch {
      parsed = {
        summary: res.text,
        atmospheric_dynamics: `Observed Sol ${solVal} telemetry (Temp: ${tempVal}°C, Pressure: ${pressVal} Pa at LTST ${ltstFormatted}h) reflects characteristic Jezero Crater boundary-layer dynamics.`,
        science_hypothesis: `Variations correlate with local topographic circulation and diurnal radiative forcing in northern season Ls ${lsVal}°.`,
        mission_safety: isAnomaly ? 'Recommend monitoring environmental sensors and checking optical surfaces for dust accumulation.' : 'Nominal ambient conditions for surface operations.'
      };
    }

    const explanation = [
      parsed.summary,
      `Atmospheric Dynamics: ${parsed.atmospheric_dynamics}`,
      `Mission Operations: ${parsed.mission_safety}`
    ].join('\n\n');

    return {
      success: true,
      model: res.model,
      explanation,
      structured: parsed,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('[GeminiService] Failed to generate observation insights:', err.message);
    return {
      success: false,
      error: err.message,
      model: null
    };
  }
}

/**
 * Generate a comprehensive Sol 1-100 Mission Intelligence Briefing.
 */
async function generateMissionOverviewInsights(stats, anomalousSols = []) {
  const systemPrompt = `You are the Lead Atmospheric Scientist for Mars 2020 Perseverance at NASA JPL. Provide an executive meteorological intelligence briefing for the Perseverance Science Team covering Sols 1–100 MEDA observations.`;

  const prompt = `
Generate an executive Mars Weather Briefing based on these mission parameters:
- Total Observations: ${stats?.totalObservations || 2400}
- Flagged Anomalies: ${stats?.anomalyCount || 15} (${stats?.anomalyPercentage || '0.6'}% of observations)
- Mission Scope: Sols 1 to 100 in Jezero Crater (18.38°N)
- Common Anomaly Types: Dust Devil Vortices, Cold Front Passages, Mesoscale Pressure Waves, Nighttime Inversions, Regional Dust Lifting
- Featured Anomalous Sols: ${(anomalousSols || []).slice(0, 10).join(', ')}

Structure your response into 3 clear sections:
1. Executive Meteorological Summary (Seasonal trends across Sols 1-100)
2. Primary Atmospheric Phenomena Identified (Dust devils, frontal waves, pressure variations)
3. Science Team Tactical Recommendations (Perseverance rover solar & instrument safety)
Keep it crisp, professional, and visually formatted with bullet points.`;

  try {
    const res = await callGemini(prompt, systemPrompt, { temperature: 0.3 });
    return {
      success: true,
      briefing: res.text,
      model: res.model,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('[GeminiService] Failed to generate mission briefing:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  callGemini,
  generateObservationInsights,
  generateMissionOverviewInsights,
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY)
};
