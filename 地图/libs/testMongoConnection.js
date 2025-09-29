// 简化的MongoDB连接测试脚本 - 兼容MongoDB驱动v6.x
const { MongoClient } = require('mongodb');

// MongoDB 连接 URL
const url = 'mongodb://localhost:27017';
const dbName = 'mapApp';

console.log('===== MongoDB 连接测试 =====');
console.log(`连接地址: ${url}`);
console.log(`数据库名: ${dbName}`);
console.log('Node.js 版本:', process.version);

// 记录开始连接时间
const startTime = Date.now();

// 简化的连接函数
async function testConnection() {
  const client = new MongoClient(url);
  
  try {
    console.log('开始连接...');
    // 连接到MongoDB服务器
    await client.connect();
    
    const connectionTime = Date.now() - startTime;
    console.log(`✓ 成功连接到MongoDB服务器，用时: ${connectionTime}ms`);
    
    // 尝试访问指定数据库
    const db = client.db(dbName);
    console.log(`已连接到数据库: ${dbName}`);
    
    // 使用更简单的方式检查数据库连接 - 创建一个集合并插入数据
    const testCollection = db.collection('testCollection');
    
    // 先删除可能存在的测试文档
    await testCollection.deleteMany({ test: true });
    
    // 插入测试文档
    const result = await testCollection.insertOne({
      test: true,
      name: '连接测试',
      timestamp: new Date(),
      message: 'MongoDB连接测试成功'
    });
    
    console.log(`✓ 成功插入测试文档，ID: ${result.insertedId}`);
    
    // 查询刚插入的文档
    const insertedDoc = await testCollection.findOne({ _id: result.insertedId });
    console.log('查询结果验证:', insertedDoc ? '成功' : '失败');
    if (insertedDoc) {
      console.log(`  插入的文档内容: { name: "${insertedDoc.name}", message: "${insertedDoc.message}" }`);
    }
    
    // 计算操作完成时间
    const totalTime = Date.now() - startTime;
    console.log(`✓ 所有操作完成，总用时: ${totalTime}ms`);
    
    // 提供连接成功的确认信息
    console.log('\n===== 连接状态总结 =====');
    console.log('MongoDB服务状态: 运行中');
    console.log('连接状态: 成功');
    console.log('数据库操作: 成功（可插入和查询数据）');
    console.log('建议: 连接成功，您可以在应用中使用以下配置:');
    console.log(`  - URL: ${url}`);
    console.log(`  - 数据库名: ${dbName}`);
    
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`✗ MongoDB操作失败，用时: ${errorTime}ms`);
    console.error('错误类型:', error.name);
    console.error('错误消息:', error.message);
    console.error('错误详情:', error);
    
    // 根据常见错误类型提供建议
    if (error.code === 'ECONNREFUSED') {
      console.log('\n建议:');
      console.log('1. 确认MongoDB服务正在运行（tasklist /fi "imagename eq mongod.exe"）');
      console.log('2. 检查MongoDB配置的端口是否为27017');
      console.log('3. 尝试使用 mongosh 命令行工具连接测试');
    } else if (error.code === 18) {
      console.log('\n建议:');
      console.log('1. 此错误通常表示认证失败');
      console.log('2. 如果MongoDB设置了密码，请在连接URL中包含认证信息');
      console.log('   例如: mongodb://username:password@localhost:27017/mapApp');
    } else {
      console.log('\n建议:');
      console.log('1. 检查MongoDB驱动版本是否兼容（当前使用的是mongodb@6.x）');
      console.log('2. 尝试使用更简单的操作来验证连接');
      console.log('3. 检查MongoDB服务日志以获取更多信息');
    }
  } finally {
    // 关闭连接
    console.log('\n关闭连接...');
    await client.close();
    console.log('连接已关闭');
  }
}

// 执行测试
console.log('开始执行连接测试...');
testConnection();