const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const { Client } = require('@notionhq/client');

// Initialize Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  refreshToken: process.env.REFRESH_TOKEN
});

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function updateNotionPageWithJson(jsonContent) {
  try {
    // First, get the current page content to preserve the title
    const currentPage = await notion.pages.retrieve({ page_id: process.env.NOTION_PAGE_ID });

    // Update the page content while preserving the title
    await notion.pages.update({
      page_id: process.env.NOTION_PAGE_ID,
      properties: currentPage.properties, // Keep existing properties
    });

    // Clear existing content and add the new JSON content
    await notion.blocks.children.append({
      block_id: process.env.NOTION_PAGE_ID,
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

    console.log('Successfully updated Notion page with JSON content');
  } catch (error) {
    console.error('Error updating Notion page:', error.message);
    console.error('Error details:', error.response?.data || error);
  }
}

async function main() {
  // Refresh access token
  try {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
  } catch (error) {
    console.error('Failed to refresh access token:', error.message);
    process.exit(1);
  }

  // Get top artists
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

  // Process each artist with more robust error handling
  const topArtists = await Promise.all(
    response.body.items.map(async (artist) => {
      try {
        // Get artist albums with error handling
        let albums = [];
        try {
          const albumsResponse = await spotifyApi.getArtistAlbums(artist.id, { limit: 3 });
          albums = albumsResponse.body.items.map(album => ({
            name: album.name,
            release_date: album.release_date,
            total_tracks: album.total_tracks
          }));
        } catch (error) {
          console.warn(`Failed to fetch albums for artist ${artist.name}:`, error.message);
        }

        // Get artist top tracks with error handling
        let topTracks = [];
        try {
          const tracksResponse = await spotifyApi.getArtistTopTracks(artist.id, 'DE');
          topTracks = await Promise.all(
            tracksResponse.body.tracks.map(async (track) => {
              try {
                let albumData = {};
                try {
                  const album = await spotifyApi.getAlbum(track.album.id);
                  albumData = album.body;
                } catch (albumError) {
                  console.warn(`Using fallback album data for track ${track.name}:`, albumError.message);
                }

                return {
                  name: track.name,
                  popularity: track.popularity,
                  preview_url: track.preview_url,
                  duration_ms: track.duration_ms,
                  album_name: track.album.name,
                  album_genres: albumData.genres || [],
                  album_release_date: track.album.release_date
                };
              } catch (trackError) {
                console.warn(`Failed to process track ${track.name}:`, trackError.message);
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
        } catch (tracksError) {
          console.warn(`Failed to fetch top tracks for artist ${artist.name}:`, tracksError.message);
        }

        return {
          id: artist.id,
          name: artist.name,
          genres: artist.genres,
          popularity: artist.popularity,
          followers: artist.followers.total,
          url: artist.external_urls.spotify,
          albums: albums,
          top_tracks: topTracks
        };
      } catch (artistError) {
        console.error(`Failed to process artist ${artist.name}:`, artistError.message);
        return {
          id: artist.id,
          name: artist.name,
          genres: artist.genres || [],
          popularity: artist.popularity,
          followers: artist.followers?.total || 0,
          url: artist.external_urls.spotify,
          albums: [],
          top_tracks: []
        };
      }
    })
  );

  // Save JSON to file
  fs.writeFileSync('spotify_top.json', JSON.stringify(topArtists, null, 2));
  console.log('Updated top artists saved to spotify_top.json');

  // Update Notion page
  try {
    await updateNotionPageWithJson(topArtists);
  } catch (error) {
    console.error('Failed to update Notion page, but JSON file was saved:', error.message);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
