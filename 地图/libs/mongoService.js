// server.js - MongoDB后端服务（兼容MongoDB v6.x驱动）
const { MongoClient } = require('mongodb');
const express = require('express');
const app = express();

// 中间件解析JSON请求体
app.use(express.json());

// MongoDB 连接配置
const url = 'mongodb://localhost:27017';
const dbName = 'mapApp';

// 声明全局数据库客户端和实例
let dbClient = null;
let dbInstance = null;

console.log('===== MongoDB后端服务启动 =====');
console.log(`连接地址: ${url}`);
console.log(`数据库名: ${dbName}`);
console.log('Node.js 版本:', process.version);

// 连接MongoDB数据库的函数
async function connectToMongoDB() {
  try {
    // 如果已经有连接，先关闭
    if (dbClient) {
      await dbClient.close();
    }
    
    // 创建新的客户端实例
    dbClient = new MongoClient(url);
    
    // 连接到MongoDB服务器
    console.log('正在连接MongoDB服务器...');
    await dbClient.connect();
    
    // 获取数据库实例
    dbInstance = dbClient.db(dbName);
    
    console.log('✓ 成功连接到MongoDB服务器');
    console.log(`✓ 已连接到数据库: ${dbName}`);
    
    // 创建必要的集合（如果不存在）
    const collections = await dbInstance.listCollections({ name: 'mapApp' }).toArray();
    if (collections.length === 0) {
      console.log('创建集合: mapApp');
      await dbInstance.createCollection('mapApp');
    }
    
    return true;
  } catch (error) {
    console.error('✗ MongoDB连接失败:');
    console.error('错误类型:', error.name);
    console.error('错误消息:', error.message);
    console.error('错误详情:', error);
    
    // 连接失败时重置客户端
    dbClient = null;
    dbInstance = null;
    
    // 设置重试机制
    setTimeout(() => {
      console.log('\n尝试重新连接MongoDB...');
      connectToMongoDB();
    }, 5000);
    
    return false;
  }
}

// 检查数据库连接状态的中间件
function checkDbConnection(req, res, next) {
  if (!dbInstance) {
    return res.status(503).json({
      error: '数据库连接未就绪',
      message: '请稍后再试'
    });
  }
  next();
}

// 后端 API 路由
// 测试API，检查服务是否正常运行
app.get('/api/test', (req, res) => {
  console.log('收到测试请求');
  res.json({
    status: 'ok', 
    message: '后端服务运行正常',
    timestamp: new Date().toISOString(),
    dbConnected: !!dbInstance
  });
});

// 获取地图数据
app.get('/api/getMapData', checkDbConnection, async (req, res) => {
  try {
    console.log('收到获取地图数据的请求');
    
    // 使用async/await方式查询数据
    const collection = dbInstance.collection('mapApp');
    const result = await collection.find({}).toArray();
    
    console.log(`成功查询到${result.length}条数据`);
    res.json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error('查询数据库失败:', error);
    res.status(500).json({
      error: '查询数据库失败', 
      details: error.message
    });
  }
});

// 保存地图数据
app.post('/api/saveMapData', checkDbConnection, async (req, res) => {
  try {
    console.log('收到保存地图数据的请求');
    const data = req.body;
    
    // 验证数据
    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        error: '无效的数据格式',
        message: '请提供有效的JSON数据'
      });
    }
    
    console.log('保存的数据:', data);
    
    // 添加时间戳
    const dataToSave = {
      ...data,
      createdAt: new Date()
    };
    
    // 使用async/await方式插入数据
    const collection = dbInstance.collection('mapApp');
    const result = await collection.insertOne(dataToSave);
    
    console.log('数据保存成功');
    res.json({
      success: true, 
      data: result.insertedId
    });
  } catch (error) {
    console.error('保存数据失败:', error);
    res.status(500).json({
      error: '保存数据失败', 
      details: error.message
    });
  }
});

// 清除所有地图数据（仅供测试用）
app.delete('/api/clearMapData', checkDbConnection, async (req, res) => {
  try {
    console.log('收到清除地图数据的请求');
    
    const collection = dbInstance.collection('mapApp');
    const result = await collection.deleteMany({});
    
    console.log(`成功清除${result.deletedCount}条数据`);
    res.json({
      success: true,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('清除数据失败:', error);
    res.status(500).json({
      error: '清除数据失败', 
      details: error.message
    });
  }
});

// 启动Express服务器
const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`\n✓ 后端服务已启动，运行在 http://localhost:${PORT}`);
  console.log('可用API:');
  console.log('  GET    /api/test          - 测试服务连接');
  console.log('  GET    /api/getMapData    - 获取地图数据');
  console.log('  POST   /api/saveMapData   - 保存地图数据');
  console.log('  DELETE /api/clearMapData  - 清除地图数据（测试用）');
  
  // 服务器启动后连接MongoDB
  console.log('\n启动MongoDB连接...');
  await connectToMongoDB();
});

// 捕获未处理的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

// 捕获未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n收到关闭信号，正在优雅关闭服务...');
  
  // 关闭MongoDB连接
  if (dbClient) {
    await dbClient.close();
    console.log('MongoDB连接已关闭');
  }
  
  console.log('服务已关闭');
  process.exit(0);
});