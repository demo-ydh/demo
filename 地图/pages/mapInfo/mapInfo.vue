<template>
	<view class="container">
		<!-- 导航记录列表 -->
		<scroll-view class="record-list" scroll-y>
			<view v-if="records.length === 0" class="empty-tip">
				<text>暂无导航记录</text>
			</view>
			
			<view v-for="(record, index) in records" :key="index" class="record-item" @tap="viewRecordDetails(record)">
					<view class="record-header">
						<text class="record-time">{{ formatDate(record.data.startTime) }}</text>
						<text class="record-mode">{{ getModeName(record.data.mode) }}</text>
					</view>
					
					<!-- 路线静态地图 -->
					<view class="record-map" :class="{ 'map-loaded': staticMapUrls[index] }">
						<image v-if="staticMapUrls[index]" :src="staticMapUrls[index]" mode="aspectFill" class="map-image"></image>
						<view v-else class="map-loading">
							<text>地图加载中...</text>
						</view>
					</view>
					
					<view class="record-route">
						<view class="route-point start">
							<text class="point-icon">📍</text>
							<text class="point-name">{{ record.data.startPoint.name || '当前位置' }}</text>
						</view>
						<view class="route-line"></view>
						<view class="route-point end">
							<text class="point-icon">🏁</text>
							<text class="point-name">{{ record.data.endPoint.name }}</text>
						</view>
					</view>
					<view class="record-info">
						<text class="record-duration">持续时间: {{ formatDuration(record.data.duration) }}</text>
						<text class="record-points">途经点: {{ record.data.points.length }} 个</text>
					</view>
				</view>
		</scroll-view>
	</view>
</template>

<script>
		// 引入高德地图SDK
		const { AMapWX } = require('../../libs/amap-wx.130.js')
		export default {
			data() {
				return {
					records: [], // 导航记录列表
					mapKey: '870dfd4461a0542da7d89cbf995185ca', // 地图API密钥（请替换为有效的密钥）
					staticMapUrls: {} // 存储每个记录的静态地图URL
				}
			},
		
		onLoad() {
			this.fetchNavigationRecords(); // 加载页面时获取导航记录
		},
		
		onShow() {
				// 页面显示时也获取一次，确保数据是最新的
				this.fetchNavigationRecords();
			},
		
		methods: {
			// 从MongoDB获取导航记录
			fetchNavigationRecords() {
				uni.request({
					url: 'http://localhost:3000/api/getMapData',
					method: 'GET',
					success: (res) => {
						console.log('获取到的导航记录数据:', res.data);
						// 筛选出类型为navigation_record的数据
						if (res.data && res.data.data) {
							this.records = res.data.data
								.filter(item => item.type === 'navigation_record')
								.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // 按时间倒序排列
						} else {
							// 兼容旧的响应格式
							this.records = res.data
								.filter(item => item.type === 'navigation_record')
								.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
						}
						
						// 记录列表更新后，为每个记录获取静态地图
						this.$nextTick(() => {
							this.records.forEach((record, index) => {
								this.getStaticMapUrl(record, index);
							});
						});
					},
					fail: (err) => {
						console.error('获取导航记录失败:', err);
						uni.showToast({
							title: '获取记录失败',
							icon: 'none'
						});
					}
				});
			},
			
			// 获取静态地图URL
			getStaticMapUrl(record, index) {
				// 如果已经获取过该记录的静态地图，则直接返回
				if (this.staticMapUrls[index]) {
					return this.staticMapUrls[index];
				}
				
				const amapwx = new AMapWX({key: this.mapKey});
				const { startPoint, endPoint, points } = record.data;
				
				// 构建路径参数
				let pathPoints = '';
				if (points && points.length > 0) {
					// 从途经点构建路径
					pathPoints = points.map(p => `${p.longitude},${p.latitude}`).join(';');
				} else if (startPoint && endPoint && startPoint.latitude && endPoint.latitude) {
					// 如果没有途经点，使用起点和终点
					pathPoints = `${startPoint.longitude},${startPoint.latitude};${endPoint.longitude},${endPoint.latitude}`;
				}
				
				// 设置中心点和缩放级别
				let center = '';
				if (startPoint && startPoint.latitude) {
					center = `${startPoint.longitude},${startPoint.latitude}`;
				} else if (endPoint && endPoint.latitude) {
					// 如果没有起点，使用终点作为中心点
					center = `${endPoint.longitude},${endPoint.latitude}`;
				} else if (points && points.length > 0) {
					// 如果没有起点和终点，但有途经点，使用第一个途经点作为中心点
					center = `${points[0].longitude},${points[0].latitude}`;
				}
				
				// 构建标记点参数
				let markers = [];
				if (startPoint && startPoint.latitude) {
					markers.push(`mid,0xFF0000,0:${startPoint.longitude},${startPoint.latitude}`); // 起点标记（红色）
				}
				if (endPoint && endPoint.latitude) {
					markers.push(`mid,0x0091ff,1:${endPoint.longitude},${endPoint.latitude}`); // 终点标记（蓝色）
				}
				
				// 调用getStaticmap方法获取静态地图URL
				console.log('准备获取静态地图，中心点:', center);
				console.log('API密钥:', this.mapKey);
				
				// 确保有有效的中心点
				if (!center) {
					console.error('静态地图获取失败: 没有有效的中心点坐标');
					// 设置一个默认中心点（北京市中心坐标）
					center = '116.405285,39.904989';
					console.log('使用默认中心点:', center);
				}
				
				amapwx.getStaticmap({
					location: center,
					zoom: 12,
					size: '300*200',
					scale: 2,
					markers: markers.join('|'),
					paths: pathPoints ? `0x0091ff,5,,:${pathPoints}` : '',
					success: (res) => {
						console.log('静态地图URL获取成功:', res.url);
						this.$set(this.staticMapUrls, index, res.url);
					},
					fail: (err) => {
						console.error('静态地图URL获取失败:', err);
						// 错误码20003通常表示KEY无效或格式错误
						if (err && err.errCode === '20003') {
							console.error('API密钥无效或已过期，请检查mapKey设置');
							// 这里可以添加一个模拟的地图URL作为备用
							const mockMapUrl = 'https://a.amap.com/jsapi/static/image?zoom=12&size=300x200&center=' + center;
							this.$set(this.staticMapUrls, index, mockMapUrl);
							console.log('使用模拟地图URL:', mockMapUrl);
						}
					}
				});
				
				// 返回一个占位符，实际URL会在获取成功后更新
				return '';
			},
			
			// 查看记录详情
			viewRecordDetails(record) {
				// 这里可以跳转到详情页面，或者在当前页面弹出详情
				console.log('查看记录详情:', record);
				uni.showModal({
					title: '导航详情',
					content: `
						开始时间: ${this.formatDate(record.data.startTime)}
						结束时间: ${this.formatDate(record.data.endTime)}
						持续时间: ${this.formatDuration(record.data.duration)}
						出行方式: ${this.getModeName(record.data.mode)}
						途经点数量: ${record.data.points.length} 个
					`,
					showCancel: false
				});
			},
			
			// 格式化日期
			formatDate(dateString) {
				if (!dateString) return '';
				const date = new Date(dateString);
				return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
			},
			
			// 格式化持续时间
			formatDuration(seconds) {
				if (!seconds) return '0分钟';
				const hours = Math.floor(seconds / 3600);
				const minutes = Math.floor((seconds % 3600) / 60);
				if (hours > 0) {
					return `${hours}小时${minutes}分钟`;
				} else {
					return `${minutes}分钟`;
				}
			},
			
			// 获取出行方式名称
			getModeName(mode) {
				const modeMap = {
					'driving': '驾车',
					'walking': '步行'
				};
				return modeMap[mode] || mode;
			}
		}
	}
</script>

<style>
	.container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: #f5f5f5;
	}
	.record-list {
		flex: 1;
		padding: 20rpx;
		box-sizing: border-box;
	}
	
	.record-item {
		background-color: white;
		border-radius: 10rpx;
		padding: 20rpx;
		margin-bottom: 20rpx;
		box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
		width: 100%;
		display: block;
		box-sizing: border-box;
	}
	.empty-tip {
		text-align: center;
		padding: 100rpx 0;
		color: #999;
		font-size: 28rpx;
	}
	
	/* 路线静态地图样式 */
	.record-map {
		height: 200rpx;
		width: 100%;
		background-color: #f5f5f5;
		border-radius: 8rpx;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 15rpx 0;
	}
	
	.map-image {
		height: 100%;
		width: 100%;
	}
	
	.map-loading {
		color: #999;
		font-size: 24rpx;
	}
	
	/* 地图加载完成后的样式变化 */
	.map-loaded {
		background-color: transparent;
	}
	.record-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15rpx;
	}
	.record-time {
		font-size: 28rpx;
		color: #333;
	}
	.record-mode {
		font-size: 24rpx;
		color: #0091ff;
		background-color: #e6f3ff;
		padding: 5rpx 15rpx;
		border-radius: 20rpx;
	}
	.record-route {
		display: flex;
		align-items: flex-start;
		margin-bottom: 15rpx;
	}
	.route-point {
		flex: 1;
		display: flex;
		align-items: flex-start;
	}
	.point-icon {
		font-size: 32rpx;
		margin-right: 10rpx;
	}
	.point-name {
		flex: 1;
		font-size: 26rpx;
		color: #666;
		line-height: 32rpx;
	}
	.route-line {
		width: 2rpx;
		background-color: #ddd;
		margin: 12rpx 0 12rpx 12rpx;
		flex-shrink: 0;
	}
	.record-info {
		display: flex;
		justify-content: space-between;
	}
	.record-duration,
	.record-points {
		font-size: 24rpx;
		color: #999;
	}
</style>
