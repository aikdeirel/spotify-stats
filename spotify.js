const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const { Client } = require('@notionhq/client');

// Initialize Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  refreshToken: process.env.REFRESH_TOKEN
});

// Initialize Notion client with ntn_ token support
const notion = new Client({
  auth: process.env.NOTION_API_KEY, // Uses ntn_ prefix token
  notionVersion: '2022-06-28' // Explicit API version
});

async function updateNotionPageWithJson(jsonContent) {
  try {
    // First verify authentication
    const user = await notion.users.me();
    console.log(`Authenticated with Notion as: ${user.name}`);

    // Get current page to preserve properties
    const currentPage = await notion.pages.retrieve({
      page_id: process.env.NOTION_PAGE_ID
    });

    // Clear existing content
    const blockResponse = await notion.blocks.children.list({
      block_id: process.env.NOTION_PAGE_ID
    });

    // Delete existing content blocks
    for (const block of blockResponse.results) {
      try {
        await notion.blocks.delete({
          block_id: block.id
        });
      } catch (error) {
        console.warn(`Could not delete block ${block.id}:`, error.message);
      }
    }

    // Add new content with JSON
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
    console.error('Notion API Error:', error.message);
    if (error.code === 'unauthorized') {
      console.error('Authentication failed. Please check:');
      console.error('1. Your token starts with "ntn_"');
      console.error('2. The integration is added to your page');
      console.error('3. The token has required permissions');
    }
    throw error; // This will make the GitHub Action fail
  }
}

async function main() {
  // Refresh Spotify access token
  try {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
  } catch (error) {
    console.error('Failed to refresh Spotify access token:', error.message);
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

  // Process each artist with robust error handling
  const topArtists = await Promise.all(
    response.body.items.map(async (artist) => {
      try {
        // Get artist albums with fallback
        let albums = [];
        try {
          const albumsResponse = await spotifyApi.getArtistAlbums(artist.id, { limit: 3 });
          albums = albumsResponse.body.items.map(album => ({
            name: album.name,
            release_date: album.release_date,
            total_tracks: album.total_tracks
          }));
        } catch (error) {
          console.warn(`Using fallback for albums (${artist.name}):`, error.message);
        }

        // Get artist top tracks with fallback
        let topTracks = [];
        try {
          const tracksResponse = await spotifyApi.getArtistTopTracks(artist.id, 'DE');
          topTracks = await Promise.all(
            tracksResponse.body.tracks.map(async (track) => {
              try {
                // Get album details with fallback
                let albumData = {};
                try {
                  const album = await spotifyApi.getAlbum(track.album.id);
                  albumData = album.body;
                } catch (error) {
                  console.warn(`Using fallback for album (${track.name}):`, error.message);
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
              } catch (error) {
                console.warn(`Using fallback for track (${track.name}):`, error.message);
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
        } catch (error) {
          console.warn(`Using fallback for top tracks (${artist.name}):`, error.message);
        }

        return {
          id: artist.id,
          name: artist.name,
          genres: artist.genres || [],
          popularity: artist.popularity,
          followers: artist.followers?.total || 0,
          url: artist.external_urls.spotify,
          albums: albums,
          top_tracks: topTracks
        };
      } catch (error) {
        console.error(`Failed to process artist (${artist.name}):`, error.message);
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
    console.error('Failed to update Notion page. JSON file was saved though.');
    throw error; // Make GitHub Action fail
  }
}

// Run the main function with proper error handling
main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
