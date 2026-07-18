const AsyncCssPlugin = require("async-css-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const dotenv = require("dotenv");
const HtmlInlineCSSWebpackPlugin = require("html-inline-css-webpack-plugin").default;
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackSkipAssetsPlugin = require("html-webpack-skip-assets-plugin").HtmlWebpackSkipAssetsPlugin;
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const { DefinePlugin } = require("webpack");

module.exports = (env, argv) => {
    const currentPath = path.join(__dirname);
    const isProduction = argv.mode === "production";

    const envFilePath = isProduction ? `${currentPath}/.env` : `${currentPath}/.env.development`;
    const envFile = dotenv.config({ path: envFilePath }).parsed || {};
    const envVars = {};
    for (const [name, value] of Object.entries(envFile)) {
        envVars[`process.env.${name}`] = JSON.stringify(value);
    }

    return {
        entry: {
            main: `${currentPath}/src/index.tsx`,
            images: `${currentPath}/src/style/partial/images.scss`,
        },
        optimization: {
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        output: {
                            comments: false,
                        },
                    },
                    extractComments: false,
                }),
            ],
        },
        output: {
            path: `${currentPath}/build`,
            publicPath: "/",
            filename: isProduction ? "asset/js/[name].[contenthash].js" : "asset/js/[name].js",
        },
        resolve: {
            extensions: [".jpg", ".js", ".json", ".jsx", ".png", ".svg", ".ts", ".tsx"],
            fallback: {
                // base-x (via CombinationId) relies on the Node Buffer API; webpack 5 no longer
                // ships node polyfills, so map it to the npm "buffer" package explicitly.
                buffer: require.resolve("buffer/"),
            },
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    exclude: /node_modules/,
                    use: [
                        "babel-loader",
                    ],
                },
                {
                    test: /\.scss/,
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader,
                        },
                        "css-loader",
                        "postcss-loader",
                        "sass-loader",
                    ],
                },
                {
                    test: /inline\/.*\.(png|svg|jpg|gif)$/,
                    type: "asset/inline",
                },
                {
                    test: /\.(png|svg|jpg|gif)$/,
                    exclude: /inline/,
                    type: "asset/resource",
                    generator: {
                        filename: "asset/image/[name][ext]",
                    },
                },
            ],
        },
        plugins: [
            new CleanWebpackPlugin(),
            new CopyPlugin({
                patterns: [
                    { from: `${currentPath}/src/root/.htaccess` },
                    { from: `${currentPath}/src/root/favicon.ico` },
                    { from: `${currentPath}/src/root/manifest.webmanifest` },
                ],
            }),
            new DefinePlugin(envVars),
            new MiniCssExtractPlugin({
                filename: isProduction ? "asset/css/[name].[contenthash].css" : "asset/css/[name].css",
            }),
            new HtmlWebpackPlugin({
                template: `${currentPath}/src/index.ejs`,
                inject: "body",
                scriptLoading: "defer",
            }),
            new HtmlWebpackSkipAssetsPlugin({
                skipAssets: [
                    /images\.(.*)\.js$/
                ],
            }),
            new HtmlInlineCSSWebpackPlugin({
                filter(fileName) {
                    return isProduction && (fileName === "index.html" || fileName.includes("main"));
                },
            }),
            new AsyncCssPlugin(),
        ],
        devServer: {
            static: {
                directory: "./build",
            },
            host: "0.0.0.0",
            hot: true,
            historyApiFallback: true,
        },
        devtool: isProduction ? false : "source-map",
    };
};
