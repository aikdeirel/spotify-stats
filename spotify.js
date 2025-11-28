const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  refreshToken: process.env.REFRESH_TOKEN
});

async function main() {
  try {
    // Refresh the access token
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
  } catch (error) {
    console.error('Failed to refresh access token:', error.message);
    process.exit(1);
  }

  let response;
  try {
    // Get top 10 artists (short_term)
    response = await spotifyApi.getMyTopArtists({
      limit: 10,
      time_range: 'short_term'
    });
  } catch (error) {
    console.error('Failed to fetch top artists:', error.message);
    process.exit(1);
  }

  // Fetch extended data for each artist
  const topArtists = await Promise.all(
    response.body.items.map(async (artist) => {
      try {
        // Fetch albums and top tracks for the artist
        const albums = await spotifyApi.getArtistAlbums(artist.id, { limit: 3 });
        const topTracks = await spotifyApi.getArtistTopTracks(artist.id, 'DE'); // 'DE' = Germany

        return {
          id: artist.id,
          name: artist.name,
          genres: artist.genres,
          popularity: artist.popularity,
          followers: artist.followers.total,
          images: artist.images,
          url: artist.external_urls.spotify,
          albums: albums.body.items.map(album => ({
            name: album.name,
            release_date: album.release_date,
            images: album.images,
            total_tracks: album.total_tracks
          })),
          top_tracks: topTracks.body.tracks.map(track => ({
            name: track.name,
            popularity: track.popularity,
            preview_url: track.preview_url,
            duration_ms: track.duration_ms
          }))
        };
      } catch (error) {
        console.error(`Failed to fetch additional data for artist ${artist.name}:`, error.message);
        // Return basic data if extended data fails
        return {
          id: artist.id,
          name: artist.name,
          genres: artist.genres,
          popularity: artist.popularity,
          followers: artist.followers.total,
          images: artist.images,
          url: artist.external_urls.spotify,
          albums: [],
          top_tracks: []
        };
      }
    })
  );

  // Save to JSON file
  fs.writeFileSync('spotify_top.json', JSON.stringify(topArtists, null, 2));
  console.log('Enhanced top artists saved to spotify_top.json');
}

main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
