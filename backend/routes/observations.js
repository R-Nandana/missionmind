const express = require('express');
const router = express.Router();
const axios = require('axios');
const Observation = require('../models/Observation');
const authMiddleware = require('../middleware/auth');
const geminiService = require('../services/geminiService');

const ANALYSIS_SERVICE_URL = (process.env.ANALYSIS_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

function buildLocalAnalysisFallback(observation) {
  const isTemperatureExtreme = observation.t_air < -60 || observation.t_air > 0;
  const isPressureExtreme = observation.pressure < 650 || observation.pressure > 800;
  const detected = Boolean(observation.is_anomaly || isTemperatureExtreme || isPressureExtreme);

  const temperatureScore = Math.min(3.5, Math.abs(observation.t_air) / 30);
  const pressureScore = Math.min(3.5, Math.abs(observation.pressure - 700) / 80);
  const score = Number(Math.max(0.8, (temperatureScore + pressureScore) / 2).toFixed(2));

  const reasons = [];
  if (observation.t_air < -60) {
    reasons.push(`Air temperature of ${observation.t_air.toFixed(1)}°C is substantially colder than the nominal Mars seasonal baseline.`);
  } else if (observation.t_air > 0) {
    reasons.push(`Air temperature of ${observation.t_air.toFixed(1)}°C is warmer than the typical Mars daytime baseline.`);
  }
  if (observation.pressure < 650 || observation.pressure > 800) {
    reasons.push(`Surface pressure of ${observation.pressure.toFixed(1)} Pa is outside the nominal Mars pressure envelope.`);
  }
  if (!reasons.length) {
    reasons.push('Measured temperature and pressure remain within expected Mars seasonal ranges.');
  }

  const explanation = detected
    ? `Telemetry-only analysis indicates a potential atmospheric anomaly for Sol ${observation.sol}. Review the observed temperature and pressure relative to Mars seasonal norms before relying on the generated explanation.`
    : `Telemetry-only analysis indicates the observation remains within Mars seasonal norms for Sol ${observation.sol}.`;

  return {
    anomaly: {
      detected,
      score,
      method: 'telemetry_fallback',
      reasons,
      variable_scores: {
        t_air: Number(observation.t_air),
        pressure: Number(observation.pressure),
      },
      severity: detected ? 'moderate' : 'normal',
    },
    similar_events: [],
    evidence: [],
    explanation,
    status: 'insufficient_evidence',
  };
}

// Get paginated observations with filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.is_anomaly !== undefined && req.query.is_anomaly !== '') {
      filter.is_anomaly = req.query.is_anomaly === 'true';
    }
    if (req.query.sol !== undefined && req.query.sol !== '') {
      filter.sol = parseInt(req.query.sol);
    }
    if (req.query.anomaly_type && req.query.anomaly_type !== 'all') {
      filter.anomaly_type = req.query.anomaly_type;
    }

    const observations = await Observation.find(filter)
      .sort({ sol: 1, ltst: 1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Observation.countDocuments(filter);

    res.json({
      observations,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      total
    });
  } catch (error) {
    console.error('Error fetching observations:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get telemetry statistics and simulation event catalog
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const totalObservations = await Observation.countDocuments();
    const anomalyCount = await Observation.countDocuments({ is_anomaly: true });
    
    // Aggregation for anomaly types
    const anomalyTypes = await Observation.aggregate([
      { $match: { is_anomaly: true } },
      { $group: { _id: '$anomaly_type', count: { $sum: 1 }, sampleSol: { $first: '$sol' } } },
      { $sort: { count: -1 } }
    ]);

    // Distinct anomalous sols for quick navigation
    const anomalousSols = await Observation.distinct('sol', { is_anomaly: true });

    res.json({
      totalObservations,
      anomalyCount,
      normalCount: totalObservations - anomalyCount,
      anomalyPercentage: totalObservations > 0 ? ((anomalyCount / totalObservations) * 100).toFixed(1) : 0,
      solMin: 1,
      solMax: 100,
      anomalyTypes,
      anomalousSols: anomalousSols.sort((a, b) => a - b)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to load telemetry stats' });
  }
});

// Get executive Mars 2020 Mission AI Intelligence Briefing across Sols 1-100
router.get('/mission-insights', authMiddleware, async (req, res) => {
  try {
    const totalObservations = await Observation.countDocuments();
    const anomalyCount = await Observation.countDocuments({ is_anomaly: true });
    const anomalousSols = await Observation.distinct('sol', { is_anomaly: true });

    const stats = {
      totalObservations,
      anomalyCount,
      anomalyPercentage: totalObservations > 0 ? ((anomalyCount / totalObservations) * 100).toFixed(1) : 0
    };

    const briefingRes = await geminiService.generateMissionOverviewInsights(
      stats,
      anomalousSols.sort((a, b) => a - b)
    );

    if (!briefingRes.success) {
      return res.status(502).json({ error: 'Failed to generate mission briefing', details: briefingRes.error });
    }

    res.json(briefingRes);
  } catch (error) {
    console.error('Error fetching mission insights:', error);
    res.status(500).json({ error: 'Failed to generate mission insights', details: error.message });
  }
});

// Get a single observation
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const observation = await Observation.findById(req.params.id);
    if (!observation) return res.status(404).json({ error: 'Not found' });
    res.json(observation);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Analyze an observation
router.post('/:id/analyze', authMiddleware, async (req, res) => {
  try {
    const observation = await Observation.findById(req.params.id);
    if (!observation) return res.status(404).json({ error: 'Not found' });

    // Request to Python Analysis Service with full telemetry parameters.
    // If the downstream service is unavailable, fall back to a deterministic
    // local analysis instead of returning a 500 to the UI.
    const payload = {
      mission: 'mars2020',
      instrument: 'meda',
      description: `Observation on Sol ${observation.sol} at ${observation.ltst} LTST. Temp: ${observation.t_air}°C, Pressure: ${observation.pressure} Pa.`,
      sol: observation.sol,
      ltst: observation.ltst,
      ls: observation.ls,
      t_air: observation.t_air,
      pressure: observation.pressure,
    };

    const fallbackAnalysis = buildLocalAnalysisFallback(observation);
    let analysisResult;

    try {
      const pythonRes = await axios.post(`${ANALYSIS_SERVICE_URL}/analyze`, payload, { timeout: 15000 });
      analysisResult = pythonRes.data || fallbackAnalysis;
    } catch (error) {
      console.warn('Analysis service failed; using local telemetry fallback:', error.message);
      analysisResult = fallbackAnalysis;
    }

    const normalizedResult = {
      ...fallbackAnalysis,
      ...analysisResult,
      anomaly: {
        ...fallbackAnalysis.anomaly,
        ...(analysisResult?.anomaly || {}),
      },
      similar_events: Array.isArray(analysisResult?.similar_events) ? analysisResult.similar_events : [],
      evidence: Array.isArray(analysisResult?.evidence) ? analysisResult.evidence : [],
      explanation: analysisResult?.explanation || fallbackAnalysis.explanation,
      status: analysisResult?.status || 'insufficient_evidence',
    };

    // If downstream service did not supply an AI explanation, enrich using Gemini AI
    const needsAiExplanation = !normalizedResult.explanation
      || normalizedResult.explanation.includes('Telemetry-only')
      || normalizedResult.explanation.includes('AI explanation is temporarily unavailable')
      || normalizedResult.explanation.includes('AI-generated explanation is unavailable')
      || normalizedResult.explanation.includes('valid OPENAI_API_KEY is required')
      || normalizedResult.status === 'insufficient_evidence';

    if (geminiService.isConfigured() && needsAiExplanation) {
      try {
        const geminiRes = await geminiService.generateObservationInsights(
          observation,
          normalizedResult.anomaly,
          normalizedResult.evidence
        );
        if (geminiRes.success) {
          normalizedResult.explanation = geminiRes.explanation;
          normalizedResult.ai_insights = geminiRes.structured;
          normalizedResult.ai_provider = 'gemini';
          normalizedResult.ai_model = geminiRes.model;
          normalizedResult.status = 'ok';
        }
      } catch (geminiErr) {
        console.warn('[ObservationsRoute] Gemini insight generation failed, using fallback:', geminiErr.message);
      }
    }

    // Save the sanitized result
    observation.analysis_result = normalizedResult;
    await observation.save();

    res.json(observation);
  } catch (error) {
    console.error('Analysis error:', error.message);
    res.status(500).json({ error: 'Analysis service failed', details: error.message });
  }
});

// Dedicated endpoint to generate or refresh Gemini AI insights for an observation
router.post('/:id/ai-insights', authMiddleware, async (req, res) => {
  try {
    const observation = await Observation.findById(req.params.id);
    if (!observation) return res.status(404).json({ error: 'Observation not found' });

    const currentAnalysis = observation.analysis_result || buildLocalAnalysisFallback(observation);
    const geminiRes = await geminiService.generateObservationInsights(
      observation,
      currentAnalysis.anomaly,
      currentAnalysis.evidence || []
    );

    if (!geminiRes.success) {
      return res.status(502).json({ error: 'Failed to generate AI insights', details: geminiRes.error });
    }

    const updatedAnalysis = {
      ...currentAnalysis,
      explanation: geminiRes.explanation,
      ai_insights: geminiRes.structured,
      ai_provider: 'gemini',
      ai_model: geminiRes.model,
      status: 'ok',
    };

    observation.analysis_result = updatedAnalysis;
    observation.markModified('analysis_result');
    await observation.save();

    res.json(observation);
  } catch (error) {
    console.error('Error generating AI insights:', error);
    res.status(500).json({ error: 'Failed to generate AI insights', details: error.message });
  }
});

module.exports = router;
