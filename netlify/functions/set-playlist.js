export default async (req) => {
  const { playlistLink } = await req.json();

  const index = playlistLink.indexOf('list=');
  if (index === -1) {
    return new Response(JSON.stringify({ error: 'Invalid playlist link' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const playlistID = playlistLink.slice(index + 5);
  const apiKey = Netlify.env.get('YOUTUBE_API_KEY');
  const songs = [];
  let pageToken = '';

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistID}&key=${apiKey}${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: 'YouTube API error: ' + data.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
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

  return new Response(JSON.stringify({ songs, count: songs.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = {
  path: '/api/set-playlist',
};
