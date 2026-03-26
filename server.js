require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://ai.hackclub.com/proxy/v1'
});

function extractAfterList(str) {
  const index = str.indexOf("list=");
  if (index === -1) return null;
  return str.slice(index + 5);
}

async function getPlaylistSongs() {
  const songs = [];
  let pageToken = '';

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistID}&key=${process.env.YOUTUBE_API_KEY}${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error('YouTube API error: ' + data.error.message);
    }

    for (const item of data.items || []) {
      const s = item.snippet;
      songs.push({
        title: s.title,
        videoId: s.resourceId.videoId,
        thumbnail: s.thumbnails?.medium?.url,
        channel: s.videoOwnerChannelTitle,
      });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return songs;
}



async function filterByVibe(songs, vibe) {
  const songList = songs.map((s, i) => `${i}: ${s.title} - ${s.channel}`).join('\n');

  const response = await openai.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{
      role: 'user',
      content: `You are a music expert. Given this list of songs, return ONLY a JSON array of index numbers for songs that match the vibe: "${vibe}. Around 7-15 songs.".

Songs:
${songList}

Return ONLY a raw JSON array like [0, 3, 7, 12]. No explanation, no markdown.`
    }]
  });

  const text = response.choices[0].message.content.trim();
  const indices = JSON.parse(text);
  return indices.map(i => songs[i]).filter(Boolean);
}

let songs = [];
let playlistID = '';

app.get('/api/songs', async (req, res) => {
  res.json(songs);
});

app.post('/api/set-playlist', async (req, res) => {
  try {
    const { playlistLink } = req.body;
    const id = extractAfterList(playlistLink);
    
    if (!id) {
      return res.status(400).json({ error: 'Invalid playlist link' });
    }
    
    playlistID = id;
    console.log('Setting playlist ID:', playlistID);
    console.log('Fetching playlist songs...');
    songs = await getPlaylistSongs();
    console.log(`Loaded ${songs.length} songs`);
    
    res.json({ count: songs.length });
  } catch (e) {
    console.error('SET PLAYLIST ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/filter', async (req, res) => {
  try {
    const { vibe } = req.body;
    console.log('Searching for vibe:', vibe);
    console.log('Using cached songs:', songs.length);
    const filtered = await filterByVibe(songs, vibe);
    console.log('Filtered results:', filtered.length);
    res.json(filtered);
  } catch (e) {
    console.error('FILTER ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Running on http://localhost:${process.env.PORT}`);
});