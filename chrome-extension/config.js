const config = {
  development: {
    API_URL: 'http://localhost:3000'
  },
  production: {
    API_URL: 'https://insightly-5iyw.onrender.com'
  }
};

// Use development config by default, can be changed when building for production
const environment = 'production';
const currentConfig = config[environment];
