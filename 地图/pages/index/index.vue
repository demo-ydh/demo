<template>
	<view class="container">
		<!-- 底部信息栏 -->
		<view class="bottom-info">
			<!-- 当前位置显示 -->
			<view class="current-location">
				<text class="location-label">当前位置：</text>
				<text class="location-text">{{ address }}</text>
			</view>
		</view>
		
		<!-- 地图视图 -->
		<view class="map-view">
			<map id="myMap" :latitude="latitude" :longitude="longitude" :markers="markers" :polyline="polyline" :show-location="true" style="width: 100%; height: 100%;"></map>
		</view>
		
		<!-- 浮动按钮 - 用于打开导航弹窗 -->
		<view class="float-action-btn" @tap="openNavDialog">
			<text>+</text>
		</view>
		
		<!-- 导航弹窗 -->
		<view v-if="showNavDialog" class="nav-dialog-overlay" @tap="closeNavDialog">
			<view class="nav-dialog" @tap.stop>
				<view class="nav-dialog-header">
					<text class="nav-dialog-title">设置导航</text>
					<view class="nav-dialog-close" @tap="closeNavDialog">×</view>
				</view>
				
				<view class="nav-dialog-content">
					<!-- 搜索区域 -->
					<view class="search-card">
						<view class="address-group">
							<view class="location-tag">
								<text class="location-text">起</text>
							</view>
							<view class="address-input-group">
								<text class="address-label">起点</text>
								<input class="address-input" type="text" v-model="startPoint.name" placeholder="当前位置" disabled />
							</view>
						</view>
						
						<view class="divider-line"></view>
						
						<view class="address-group">
							<view class="location-tag">
								<text class="location-text">终</text>
							</view>
							<view class="address-input-group">
								<text class="address-label">终点</text>
								<input class="address-input" type="text" v-model="endPoint.name" placeholder="请输入终点" @input="onEndInput"/>
							</view>
						</view>
					</view>
					
					<!-- 搜索结果下拉框 - 集成在弹窗内部 -->
					<view v-if="showSearchResults" class="search-results">
						<view v-for="(tip, index) in searchResults" :key="index" class="search-result-item" @tap="selectSearchResult(tip)">
							<view class="result-icon">
								<text class="place-text">📍</text>
							</view>
							<view class="result-content">
								<text class="search-result-name">{{ tip.name }}</text>
								<text class="search-result-address">{{ tip.address }}</text>
							</view>
						</view>
					</view>
					
					<!-- 出行方式选择 -->
					<view class="mode-selector">
						<text class="selector-title">选择出行方式</text>
						<picker @change="onModeChange" :range="modes" range-key="name" :value="modeIndex">
							<view class="picker">
								{{ modes[modeIndex].name }}
								<view class="picker-arrow"></view>
							</view>
						</picker>
					</view>
				</view>
				
				<view class="nav-dialog-footer">
					<button v-if="!isNavigating" class="nav-button start-nav" @tap="confirmNavigation">开始导航</button>
					<button v-if="isNavigating" class="nav-button stop-nav" @tap="stopNavigation">结束导航</button>
					<text v-if="isNavigating" class="nav-status">导航中...</text>
				</view>
			</view>
		</view>
		

	</view>
</template>

<script>
		// 引入高德地图SDK
	const { AMapWX } = require('../../libs/amap-wx.130.js')
	export default {
		data() {
			return {
				latitude: 0,
				longitude: 0,
				address: '定位中...',
				markers: [],
				polyline: [], // 路线数据
				amapKey: '870dfd4461a0542da7d89cbf995185ca',
				modes: [
					{name: '驾车', value: 'driving'},
					{name: '步行', value: 'walking'}
				],
				startPoint: {name: '当前位置', latitude: 0, longitude: 0},
				endPoint: {name: '', latitude: 0, longitude: 0},
				modeIndex: 0,
				selectedMode: 'driving',
				searchResults:[],
				showSearchResults:false,
				currentSearchType:'', //start 或 end
				isNavigating: false, // 是否正在导航
				navigationInterval: null, // 导航定时器
				navigationPoints: [], // 导航过程中的位置点
				navigationStartTime: null, // 导航开始时间
				navigationEndTime: null, // 导航结束时间
				showNavDialog: false // 导航弹窗显示状态
			}
		},
		onLoad() {
			this.loadMap();
			this.fetchMapData(); // 加载页面时获取MongoDB数据
		},
		methods: {
			// 从MongoDB获取数据
			fetchMapData() {
				// 注意：微信小程序中需要配置合法域名或使用开发环境的不校验域名选项
				uni.request({
					url: 'http://localhost:3000/api/getMapData',
					method: 'GET',
					success: (res) => {
					console.log('从MongoDB获取的数据:', res.data);
					// 处理获取到的数据
					},
					fail: (err) => {
						console.error('获取数据失败:', err);
					}
				});
			},

			// 保存数据到MongoDB
			saveMapData(data) {
				uni.request({
					url: 'http://localhost:3000/api/saveMapData',
					method: 'POST',
					data: data,
					success: (res) => {
					console.log('保存数据成功:', res.data);
					},
					fail: (err) => {
						console.error('保存数据失败:', err);
					}
				});
			},
			// 选择出行方式变化
			onModeChange(e) {
				this.modeIndex = e.detail.value;
				this.selectedMode = this.modes[this.modeIndex].value;
				console.log('选择的出行方式：', this.selectedMode);
				// 切换出行方式后，重新获取路线
				this.getRouteByMode();
			},
			loadMap() {
				// 创建地图实例
				const amapwx = new AMapWX({key: this.amapKey})
				// 使用 getRegeo 方法获取当前位置和地址信息
				amapwx.getRegeo({
					// 如果不提供 location 参数，SDK 会自动获取当前位置
					success: (res) => {
						if (res && res[0]) {
							// 更新地址信息
							this.address = res[0].name
							// 更新经纬度
							this.latitude = res[0].latitude
							this.longitude = res[0].longitude
							// 添加标记点
							this.markers = [{
								id: 0,
								latitude: res[0].latitude,
								longitude: res[0].longitude,
								width: 30,
								height: 30,
	
							}]
						} else {
							this.address = '未能获取详细地址'
						}
					},
					fail: (err) => {
						console.log('获取位置和地址失败：', err)
						this.address = '获取位置失败'
					}
				})
			},
			// 选择终点
			selectEndPoint() {
				this.currentSearchType = 'end';
				if (this.endPoint.name) {
					this.getInputTips(this.endPoint.name);
				}
			},
			
			// 打开导航弹窗
			openNavDialog() {
				this.showNavDialog = true;
			},
			
			// 关闭导航弹窗
			closeNavDialog() {
				this.showNavDialog = false;
			},
			
			// 确认导航设置并开始导航
			confirmNavigation() {
				if (!this.endPoint.latitude || !this.endPoint.longitude) {
					uni.showToast({
						title: '请先选择终点',
						icon: 'none'
					});
					return;
				}
				
				this.closeNavDialog();
				this.startNavigation();
			},
			
			// 终点输入事件
			onEndInput(e) {
				const keywords = e.detail.value;
				this.currentSearchType = 'end';
				if (keywords.length > 0) {
					this.getInputTips(keywords);
				} else {
					this.showSearchResults = false;
				}
			},
			
			// 获取输入提示（模糊搜索）
			getInputTips(keywords) {
				const amapwx = new AMapWX({key: this.amapKey});
				amapwx.getInputtips({
				keywords: keywords,
				location: '', // 以当前位置为中心
				citylimit: true, // 限制城市
				success: (res) => {
					this.searchResults = res.tips;
					this.showSearchResults = this.searchResults.length > 0;
				},
				fail: (err) => {
					console.log('获取输入提示失败：', err);
				}
				});
			},
			
			// 选择搜索结果
			selectSearchResult(tip) {
				console.log('选择的搜索结果：', tip);
				// 隐藏搜索结果
				this.showSearchResults = false;
				// 根据当前搜索类型设置起点或终点
				if (this.currentSearchType === 'end') {
					this.endPoint.name = tip.name;
					// 获取详细地址信息以获取经纬度
					this.getLocationByAddress(tip.name, 'end');
				}
			},
			
			// 根据地址获取经纬度
			getLocationByAddress(address, type) {
				const amapwx = new AMapWX({key: this.amapKey});
				amapwx.getGeo({
					options: {
						address: address
					},
					success: (res) => {
						console.log('地址解析结果：', res);
						if (res) {
							const [longitude, latitude] = res.geocodes[0].location.split(',').map(Number);
							this.endPoint.latitude = latitude;
							this.endPoint.longitude = longitude;
							// 添加终点标记
							this.addEndMarker();
						} else {
							console.log('地址解析结果格式不正确：', res);
						}
					},
					fail: (err) => {
						console.log('根据地址获取经纬度失败：', err);
					}
				})
			},
			
			// 添加终点标记
			addEndMarker() {
				console.log('准备添加终点标记，当前endPoint:', this.endPoint);
				// 确保endPoint有有效的经纬度
				if (this.endPoint && typeof this.endPoint.latitude === 'number' && typeof this.endPoint.longitude === 'number') {
					// 先清空除了当前位置以外的标记
					const currentLocationMarker = this.markers.find(marker => marker.id === 0);
					this.markers = currentLocationMarker ? [currentLocationMarker] : [];
					 
					// 添加终点标记
					this.markers.push({
						id: 1,
						latitude: this.endPoint.latitude,
						longitude: this.endPoint.longitude,
						width: 30,
						height: 30,

					});
					console.log('添加终点标记成功：', this.markers);
					// 调用路线规划
					this.getRouteByMode();
				} else {
					console.log('终点经纬度无效或未定义');
				}
			},
			
			// 开始导航
			startNavigation() {
				if (!this.endPoint.latitude || !this.endPoint.longitude) {
					uni.showToast({
						title: '请先选择终点',
						icon: 'none'
					});
					return;
				}
				
				this.isNavigating = true;
				this.navigationStartTime = new Date();
				this.navigationPoints = [];
				
				// 立即获取当前位置作为第一个点
				this.getCurrentLocationAndMark();
				
				// 设置定时器，每10分钟获取一次位置
				const TEN_MINUTES = 10 * 60 * 1000;
				this.navigationInterval = setInterval(() => {
					this.getCurrentLocationAndMark();
				}, TEN_MINUTES);
				
				uni.showToast({
					title: '开始导航',
					icon: 'success'
				});
			},
			
			// 结束导航
			stopNavigation() {
				this.isNavigating = false;
				this.navigationEndTime = new Date();
				
				// 清除定时器
				if (this.navigationInterval) {
					clearInterval(this.navigationInterval);
					this.navigationInterval = null;
				}
				
				// 最后再获取一次位置
				this.getCurrentLocationAndMark();
				
				// 保存导航记录到数据库
				this.saveNavigationRecord();
				
				uni.showToast({
					title: '导航已结束',
					icon: 'success'
				});
			},
			
			// 获取当前位置并标点
			getCurrentLocationAndMark() {
				const amapwx = new AMapWX({key: this.amapKey});
				
				amapwx.getRegeo({
					success: (res) => {
						if (res && res[0]) {
							const currentPosition = {
								latitude: res[0].latitude,
								longitude: res[0].longitude,
								address: res[0].name,
								timestamp: new Date().getTime(),
								time: new Date().toLocaleString()
							};
							
							// 添加到导航点数组
							this.navigationPoints.push(currentPosition);
							
							// 创建新的标记点
							const newMarker = {
								id: Date.now(), // 使用时间戳作为唯一ID
								latitude: currentPosition.latitude,
								longitude: currentPosition.longitude,
								width: 20,
								height: 20,
								
								label: {
									content: currentPosition.time.split(' ')[1], // 显示时间
									color: '#ff0000',
									fontSize: 10
								}
							};
							
							// 添加到标记数组
							this.markers.push(newMarker);
							
							console.log('添加导航点：', currentPosition);
						}
					},
					fail: (err) => {
						console.error('获取位置失败：', err);
					}
				});
			},
			
			// 保存导航记录到MongoDB
			saveNavigationRecord() {
				const navigationRecord = {
					startTime: this.navigationStartTime,
					endTime: this.navigationEndTime,
					duration: (this.navigationEndTime - this.navigationStartTime) / 1000, // 持续时间（秒）
					startPoint: this.startPoint,
					endPoint: this.endPoint,
					points: this.navigationPoints,
					mode: this.selectedMode
				};
				
				console.log('保存导航记录：', navigationRecord);
				
				// 调用保存数据的方法
				this.saveMapData({
					type: 'navigation_record',
					data: navigationRecord,
					createdAt: new Date()
				});
			},
			
			// 根据选择的出行方式获取路线
			getRouteByMode() {
				if (!this.endPoint.latitude || !this.endPoint.longitude) {
					return;
				}
				
				const amapwx = new AMapWX({key: this.amapKey});
				const origin = `${this.longitude},${this.latitude}`;
				const destination = `${this.endPoint.longitude},${this.endPoint.latitude}`;
				
				switch (this.selectedMode) {
					case 'driving':
						this.getDrivingRoute(amapwx, origin, destination);
						break;
					case 'walking':
						this.getWalkingRoute(amapwx, origin, destination);
						break;
					// case 'riding':
					// 	this.getRidingRoute(amapwx, origin, destination);
					// 	break;
				}
			},
			
			// 获取驾车路线
			getDrivingRoute(amapwx, origin, destination) {
				amapwx.getDrivingRoute({
					origin: origin,
					destination: destination,
					success: (res) => {
						console.log('驾车路线：', res);
						this.drawRoute(res);
					},
					fail: (err) => {
						console.log('获取驾车路线失败：', err);
					}
					});
			},
			
			// 获取步行路线
			// getWalkingRoute(amapwx, origin, destination) {
			// 	amapwx.getWalkingRoute({
			// 	origin: origin,
			// 	destination: destination,
			// 	success: (res) => {
			// 		console.log('步行路线：', res);
			// 		this.drawRoute(res);
			// 	},
			// 	fail: (err) => {
			// 		console.log('获取步行路线失败：', err);
			// 	}
			// 	});
			// },
			
			// 获取骑行路线
			getRidingRoute(amapwx, origin, destination) {
				amapwx.getRidingRoute({
					origin: origin,
					destination: destination,
					success: (res) => {
						console.log('骑行路线：', res);
						this.drawRoute(res);
					},
					fail: (err) => {
						console.log('获取骑行路线失败：', err);
					}
				});
			},
			
			// 绘制路线
			drawRoute(res) {
				if (!res.paths || res.paths.length === 0) {
					console.log('无路线数据');
					return;
				}
				
				// 清空之前的路线
				this.polyline = [];
				
				// 获取第一条路线
				const path = res.paths[0];
				
				// 解析路线坐标点
				const polylinePoints = [];
				if (path.steps && path.steps.length > 0) {
					for (let i = 0; i < path.steps.length; i++) {
						const step = path.steps[i];
						// 解析polyline字符串为坐标点数组
						const points = this.parsePolyline(step.polyline);
						polylinePoints.push(...points);
					}
				} else if (path.polyline) {
					// 有些API版本直接返回polyline字符串
					const points = this.parsePolyline(path.polyline);
					polylinePoints.push(...points);
				}
				
				if (polylinePoints.length > 0) {
					// 创建路线对象
					this.polyline = [{
						points: polylinePoints,
						color: '#0091ff',
						width: 6,
						dottedLine: false,
						arrowLine: true,
		
						borderWidth: 1,
						borderColor: '#ffffff'
					}];
				}
			},
			
			// 解析polyline字符串为坐标点数组
			parsePolyline(polyline) {
				if (!polyline) return [];
				
				const points = [];
				const coords = polyline.split(';');
				
				for (let i = 0; i < coords.length; i++) {
					const coord = coords[i].split(',');
					if (coord.length === 2) {
						points.push({
							latitude: parseFloat(coord[1]),
							longitude: parseFloat(coord[0])
						});
					}
				}
				return points;
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
		position: relative;
	}
	
	/* 浮动按钮样式 */
	.float-action-btn {
		position: fixed;
		right: 40rpx;
		bottom: 200rpx;
		width: 100rpx;
		height: 100rpx;
		background-color: #0091ff;
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 60rpx;
		line-height: 1;
		box-shadow: 0 4rpx 20rpx rgba(0, 145, 255, 0.5);
		z-index: 999;
	}
	
	/* 导航弹窗样式 */
	.nav-dialog-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1001;
	}
	
	.nav-dialog {
		width: 85%;
		max-height: 70vh;
		background-color: #ffffff;
		border-radius: 20rpx;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	
	.nav-dialog-header {
		padding: 24rpx 30rpx;
		border-bottom: 1px solid #eee;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	
	.nav-dialog-title {
		font-size: 32rpx;
		font-weight: bold;
		color: #333;
	}
	
	.nav-dialog-close {
		font-size: 40rpx;
		color: #999;
		line-height: 1;
	}
	
	.nav-dialog-content {
		padding: 20rpx;
		overflow-y: auto;
	}
	
	.nav-dialog-footer {
		padding: 20rpx;
		border-top: 1px solid #eee;
		text-align: center;
	}
	
	.search-card {
		background-color: #f8f8f8;
		border-radius: 20rpx;
		overflow: hidden;
	}
	
	.address-group {
		display: flex;
		align-items: center;
		padding: 20rpx;
	}
	
	.location-tag {
		width: 60rpx;
		height: 60rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #ffffff;
		border-radius: 50%;
		box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.1);
	}
	
	.location-icon {
	width: 32rpx;
	height: 32rpx;
	}
	
	.location-text {
		font-size: 24rpx;
		color: #0091ff;
		font-weight: bold;
	}
	
	.place-text {
		font-size: 32rpx;
	}
		
	.address-input-group {
		flex: 1;
		margin-left: 20rpx;
	}
	
	.address-label {
		display: block;
		font-size: 24rpx;
		color: #666;
		margin-bottom: 8rpx;
	}
	
	.address-input {
		width: 100%;
		height: 60rpx;
		background-color: transparent;
		font-size: 28rpx;
		color: #333;
		padding: 0;
		border: none;
	}
	
	.divider-line {
		height: 1px;
		background-color: #e0e0e0;
		margin: 0 20rpx;
	}
	
	/* 出行方式选择器样式 */
	.mode-selector {
		padding: 20rpx;
		background-color: #ffffff;
		margin: 10rpx;
		border-radius: 12rpx;
		box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
	}
	
	.selector-title {
		font-size: 28rpx;
		color: #333333;
		display: block;
		margin-bottom: 10rpx;
	}
	
	.picker {
		background-color: #f5f5f5;
		padding: 20rpx;
		border-radius: 8rpx;
		font-size: 28rpx;
		color: #333333;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	
	.picker-arrow {
		width: 20rpx;
		height: 20rpx;
		border-top: 2rpx solid #999;
		border-right: 2rpx solid #999;
		transform: rotate(45deg);
	}
	
	/* 地图视图样式 */
	.map-view {
		flex: 1;
		background-color: #ffffff;
		margin: 10rpx;
		border-radius: 12rpx;
		overflow: hidden;
		box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
	}
	
	/* 底部信息栏样式 */
	.bottom-info {
		background-color: #ffffff;
		padding: 20rpx;
		border-top: 1px solid #eee;
	}
	
	/* 当前位置显示样式 */
	.current-location {
		margin-bottom: 20rpx;
		padding: 10rpx;
		background-color: #f8f8f8;
		border-radius: 8rpx;
	}
	
	.location-label {
		font-size: 26rpx;
		color: #666;
	}
	
	.location-text {
		font-size: 26rpx;
		color: #333;
		margin-left: 10rpx;
	}
	
	/* 导航控制按钮样式 */
	.navigation-controls {
		text-align: center;
	}
	
	.nav-button {
		width: 100%;
		height: 90rpx;
		line-height: 90rpx;
		font-size: 32rpx;
		font-weight: bold;
		border-radius: 45rpx;
		margin: 10rpx 0;
		border: none;
		box-shadow: 0 4rpx 20rpx rgba(0,145,255,0.3);
	}
	
	.start-nav {
		background-color: #0091ff;
		color: white;
	}
	
	.stop-nav {
		background-color: #ff4d4f;
		color: white;
		box-shadow: 0 4rpx 20rpx rgba(255,77,79,0.3);
	}
	
	.nav-status {
		display: block;
		margin-top: 15rpx;
		color: #0091ff;
		font-size: 28rpx;
		font-weight: bold;
	}
	
	/* 搜索结果样式 */
	.search-results {
			position: relative;
			width: 100%;
			background-color: #fff;
			border-radius: 12rpx;
			box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.1);
			max-height: 500rpx;
			overflow-y: auto;
			margin-top: 10rpx;
		}
	
	.search-result-item {
		display: flex;
		align-items: center;
		padding: 20rpx;
		border-bottom: 1rpx solid #f0f0f0;
	}
	
	.search-result-item:active {
		background-color: #f5f5f5;
	}
	
	.result-icon {
		width: 50rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.result-icon image {
		width: 32rpx;
		height: 32rpx;
	}
	
	.result-content {
		flex: 1;
	}
	
	.search-result-name {
		display: block;
		font-size: 28rpx;
		color: #333;
		margin-bottom: 8rpx;
		font-weight: 500;
	}
	
	.search-result-address {
		display: block;
		font-size: 24rpx;
		color: #999;
	}
</style>