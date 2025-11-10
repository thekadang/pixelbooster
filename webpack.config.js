// webpack.config.js - Webpack 설정 파일
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';

  return {
    // 진입점
    entry: './client/src/index.jsx',

    // 출력 설정
    output: {
      path: path.resolve(__dirname, 'client/dist'),
      filename: '[name].bundle.js',
      clean: true // 빌드 시 이전 파일 삭제
    },

    // 개발 모드 설정
    mode: isDevelopment ? 'development' : 'production',

    // 소스맵 설정 (디버깅 용이)
    // eval-source-map 대신 inline-source-map 사용 (CSP 'unsafe-eval' 불필요)
    devtool: isDevelopment ? 'inline-source-map' : 'source-map',

    // 개발 서버 설정
    devServer: {
      static: {
        directory: path.join(__dirname, 'client/dist')
      },
      port: 3000,
      hot: true, // 핫 모듈 리플레이스먼트
      compress: true,
      historyApiFallback: true // SPA 라우팅 지원
    },

    // 모듈 해석 규칙
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'client/src'),
        '@shared': path.resolve(__dirname, 'shared')
      }
    },

    // 로더 설정
    module: {
      rules: [
        {
          // JavaScript/JSX 파일 처리
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'automatic' }]
              ]
            }
          }
        },
        {
          // CSS 파일 처리
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          // 이미지 파일 처리
          test: /\.(png|jpg|jpeg|gif|svg)$/,
          type: 'asset/resource'
        },
        {
          // 폰트 파일 처리
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: 'asset/resource'
        }
      ]
    },

    // 플러그인
    plugins: [
      new HtmlWebpackPlugin({
        template: './client/src/index.html',
        filename: 'index.html',
        inject: 'body'
      })
    ],

    // 최적화 설정
    optimization: {
      minimize: !isDevelopment,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    },

    // Electron 환경을 위한 target 설정
    target: 'electron-renderer',

    // Node.js 폴리필 비활성화 (Electron에서는 필요 없음)
    node: {
      __dirname: false,
      __filename: false
    }
  };
};
