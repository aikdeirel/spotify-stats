const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const { Client } = require('@notionhq/client');

// Notion API initialisieren
const notion = new Client({ auth: process.env.NOTION_API_KEY });

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  refreshToken: process.env.REFRESH_TOKEN
});

// Notion-Seiten-ID (ersetze mit deiner Seiten-ID)
const notionPageId = 'DEINE_NOTION_SEITEN_ID';

async function updateNotionPageWithJson(jsonContent) {
  try {
    await notion.blocks.children.update({
      block_id: notionPageId,
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "```json\n" + JSON.stringify(jsonContent, null, 2) + "\n```",
                },
              },
            ],
          },
        },
      ],
    });
    console.log('Notion page updated with JSON content');
  } catch (error) {
    console.error('Failed to update Notion page:', error.message);
  }
}

async function main() {
  try {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
  } catch (error) {
    console.error('Failed to refresh access token:', error.message);
    process.exit(1);
  }

  let response;
  try {
    response = await spotifyApi.getMyTopArtists({
      limit: 10,
      time_range: 'short_term'
    });
  } catch (error) {
    console.error('Failed to fetch top artists:', error.message);
    process.exit(1);
  }

  const topArtists = await Promise.all(
    response.body.items.map(async (artist) => {
      try {
        const albums = await spotifyApi.getArtistAlbums(artist.id, { limit: 3 });
        const topTracks = await spotifyApi.getArtistTopTracks(artist.id, 'DE');
        const tracksWithAlbums = await Promise.all(
          topTracks.body.tracks.map(async (track) => {
            try {
              const album = await spotifyApi.getAlbum(track.album.id);
              return {
                name: track.name,
                popularity: track.popularity,
                preview_url: track.preview_url,
                duration_ms: track.duration_ms,
                album_name: track.album.name,
                album_genres: album.body.genres || [],
                album_release_date: track.album.release_date
              };
            } catch (error) {
              console.error(`Failed to fetch album for track ${track.name}:`, error.message);
              return {
                name: track.name,
                popularity: track.popularity,
                preview_url: track.preview_url,
                duration_ms: track.duration_ms,
                album_name: track.album.name,
                album_genres: [],
                album_release_date: track.album.release_date
              };
            }
          })
        );
        return {
          id: artist.id,
          name: artist.name,
          genres: artist.genres,
          popularity: artist.popularity,
          followers: artist.followers.total,
          url: artist.external_urls.spotify,
          albums: albums.body.items.map(album => ({
            name: album.name,
            release_date: album.release_date,
            total_tracks: album.total_tracks
          })),
          top_tracks: tracksWithAlbums
        };
      } catch (error) {
        console.error(`Failed to fetch additional data for artist ${artist.name}:`, error.message);
        return {
          id: artist.id,
          name: artist.name,
          genres: artist.genres,
          popularity: artist.popularity,
          followers: artist.followers.total,
          url: artist.external_urls.spotify,
          albums: [],
          top_tracks: []
        };
      }
    })
  );

  // JSON-Datei speichern
  fs.writeFileSync('spotify_top.json', JSON.stringify(topArtists, null, 2));
  console.log('Updated top artists saved to spotify_top.json');

  // JSON-Inhalt an Notion senden
  await updateNotionPageWithJson(topArtists);
}

main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
