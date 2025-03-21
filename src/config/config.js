const config = {
    APP_ID: process.env.REACT_APP_APP_ID ,
    ACCESS_KEY: process.env.REACT_APP_ACCESS_KEY,
    REGION: process.env.REACT_APP_REGION,
    IMGBB_API_KEY: process.env.REACT_APP_IMGBB_API_KEY,
    CLOUD_NAME : process.env.CLOUD_NAME,
    CLOUD_NAME : process.env.UPLOAD_PRESET,
    get API_URL() {
        return `https://${this.REGION}.appsheet.com/api/v2/apps/${this.APP_ID}/tables`;
    },
    
    ROUTES: {
        LOGIN: '/',
        DASHBOARD: '/dashboard',
        PROFILE: '/profile',
        PRODUCTS: '/products',
        TABLES: '/tables',
        ORDERS: '/orders',
        THUCHI: '/thuchi',
    },
    
    AUTH: {
        TOKEN_KEY: 'authToken',
        USER_DATA_KEY: 'userData',
        TOKEN_EXPIRY_KEY: 'tokenExpiry',
        TOKEN_DURATION: parseInt(process.env.REACT_APP_TOKEN_DURATION)
    },
    
    UPLOAD: {
        MAX_SIZE: parseInt(process.env.REACT_APP_MAX_UPLOAD_SIZE),
        ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
        IMGBB_URL: process.env.REACT_APP_IMGBB_URL
    }
};

export default config;