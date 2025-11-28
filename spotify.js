const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  refreshToken: process.env.REFRESH_TOKEN
});

async function main() {
  // Refresh the access token
  const data = await spotifyApi.refreshAccessToken();
  spotifyApi.setAccessToken(data.body['access_token']);

  // Get top 10 artists (short_term)
  const response = await spotifyApi.getMyTopArtists({
    limit: 10,
    time_range: 'short_term'
  });

  const topArtists = response.body.items.map(artist => ({
    name: artist.name,
    genres: artist.genres,
    popularity: artist.popularity,
    url: artist.external_urls.spotify
  }));

  // Save to JSON file
  fs.writeFileSync('spotify_top.json', JSON.stringify(topArtists, null, 2));
  console.log('Top artists saved to spotify_top.json');
}

main().catch(console.error);
