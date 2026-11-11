import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: lastPrompt, error: lastPromptError } = await supabaseClient
      .from('daily_prompts')
      .select('*')
      .order('published_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPromptError) throw lastPromptError;

    let currentSeasonId = 1;
    let nextDayNumber = 1;

    if (lastPrompt) {
      if (lastPrompt.day_number < 14) {
        currentSeasonId = lastPrompt.season_id;
        nextDayNumber = lastPrompt.day_number + 1;
      } else {
        currentSeasonId = lastPrompt.season_id + 1;
        nextDayNumber = 1;
      }
    }

    let fullNarrativeContext = "La storia inizia ora.";
    
    if (nextDayNumber > 1) {
      const { data: historyData } = await supabaseClient
        .from('daily_prompts')
        .select('prompt_text, winning_response, winning_username')
        .eq('season_id', currentSeasonId)
        .order('day_number', { ascending: true });

      if (historyData && historyData.length > 0) {
        fullNarrativeContext = historyData.map(item => {
          let line = `${item.prompt_text}`;
          if (item.winning_response) {
             line += ` [L'utente ${item.winning_username || 'ignoto'} risponde: "${item.winning_response}"]`;
          }
          return line;
        }).join(" -> ");
      }
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY non trovata nelle variabili d'ambiente");
    }

    // SYSTEM INSTRUCTION (Regole assolute per Gemini)
    const systemInstructionText = `Sei uno scrittore provocatorio, ironico, a tratti filosofico o passionale. NON SEI UN ROBOT O UN HACKER. Dimentica tutto ciò che sai su fantascienza, cyberpunk, neon e reti. Parliamo di esseri umani, di vita vera, di filosofia da bar o di battute taglienti.
REGOLE DI OUTPUT TASSATIVE: 
1. Genera SEMPRE E SOLO UNA SINGOLA FRASE.
2. Lunghezza massima: 15 parole.
3. Vietato usare parole tech.`;

    // USER PROMPT (Il contesto per questa chiamata)
    const userPromptText = `Ecco la storia finora:\n${fullNarrativeContext}\n\nScrivi la prossima frase. Ricorda: UNA SOLA FRASE, massimo 15 parole, zero tecnologia, tono umano e aperto.`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemInstructionText }]
      },
      contents: [{
        role: "user",
        parts: [{ text: userPromptText }]
      }],
      generationConfig: {
        temperature: 1.2, // Più alto = più imprevedibile
        maxOutputTokens: 40 // Blocco fisico della lunghezza
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const aiData = await response.json();

    if (!response.ok) {
        throw new Error(`Errore Gemini API: ${JSON.stringify(aiData)}`);
    }

    let aiResponseText = aiData.candidates[0].content.parts[0].text.trim();
    aiResponseText = aiResponseText.replace(/^["']|["']$/g, '');

    const todayStr = new Date().toISOString().split('T')[0];

    const { error: insertError } = await supabaseClient
      .from('daily_prompts')
      .insert({
        season_id: currentSeasonId,
        day_number: nextDayNumber,
        prompt_text: aiResponseText,
        published_date: todayStr
      });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        season: currentSeasonId, 
        day: nextDayNumber, 
        prompt: aiResponseText 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Errore nella Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})