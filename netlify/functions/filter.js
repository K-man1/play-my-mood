import OpenAI from 'openai';

export default async (req) => {
  const { songs, vibe } = await req.json();

  const openai = new OpenAI({
    apiKey: Netlify.env.get('OPENAI_API_KEY'),
    baseURL: 'https://ai.hackclub.com/proxy/v1',
  });

  const songList = songs.map((s, i) => `${i}: ${s.title} - ${s.channel}`).join('\n');

  const response = await openai.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{
      role: 'user',
      content: `You are a music expert. Given this list of songs, return ONLY a JSON array of index numbers for songs that match the vibe: "${vibe}. Around 7-15 songs.".

Songs:
${songList}

Return ONLY a raw JSON array like [0, 3, 7, 12]. No explanation, no markdown.`,
    }],
  });

  const text = response.choices[0].message.content.trim();
  const indices = JSON.parse(text);
  const filtered = indices.map(i => songs[i]).filter(Boolean);

  return new Response(JSON.stringify(filtered), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = {
  path: '/api/filter',
};
