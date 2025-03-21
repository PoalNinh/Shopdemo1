import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import {
    UtensilsCrossed, Table as TableIcon, Receipt,
    TrendingUp, Users, Loader2, Calendar
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { DatePicker } from "../components/ui/datepicker";
import authUtils from '../utils/authUtils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const formatCurrency = (value) => {
    if (value >= 1e9) return (value / 1e9).toFixed(1) + ' tỷ';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + ' triệu';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + ' nghìn';
    return value + 'đ';
};

const StatCardSkeleton = () => (
    <Card className="animate-pulse">
        <CardContent className="p-4">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <div className="h-3 w-20 bg-gray-200 rounded"></div>
                    <div className="h-6 w-24 bg-gray-300 rounded"></div>
                    <div className="h-3 w-28 bg-gray-200 rounded"></div>
                </div>
                <div className="bg-gray-300 rounded-lg p-2 w-8 h-8"></div>
            </div>
        </CardContent>
    </Card>
);

const ChartSkeleton = ({ height = "h-72" }) => (
    <Card>
        <CardHeader>
            <div className="h-5 w-36 bg-gray-200 rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
            <div className={`${height} bg-gray-100 rounded-lg animate-pulse flex items-center justify-center`}>
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        </CardContent>
    </Card>
);

const StatCard = ({ title, value, icon: Icon, color, percentageChange, isCurrency }) => (
    <Card className="transition-transform duration-200 hover:scale-[1.02]">
        <CardContent className="p-4">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
                    <h3 className="text-xl font-bold text-gray-800">
                        {isCurrency ? formatCurrency(value) : value}
                    </h3>
                    {percentageChange !== undefined && (
                        <p className={`text-xs mt-1 flex items-center ${percentageChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            <span className={`mr-1 ${percentageChange > 0 ? 'rotate-0' : 'rotate-180'}`}>↑</span>
                            {Math.abs(percentageChange)}% so với hôm qua
                        </p>
                    )}
                </div>
                <div className={`${color} rounded-lg p-2`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
            </div>
        </CardContent>
    </Card>
);

const Dashboard = () => {
    const [allData, setAllData] = useState({
        products: [],
        tables: [],
        salesByHour: [],
        orders: [],
        orderDetails: []
    });
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)),
        end: new Date()
    });
    const [chartType, setChartType] = useState('line');
    const [timeFilter, setTimeFilter] = useState('30d');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analyticsData, setAnalyticsData] = useState({
        revenueData: [],
        productStats: [],
        tableUsage: [],
        paymentStats: {},
    });

    const handleTimeFilterChange = (value) => {
        setTimeFilter(value);
        const end = new Date();
        let start = new Date();

        switch (value) {
            case '7d':
                start.setDate(end.getDate() - 7);
                break;
            case '30d':
                start.setDate(end.getDate() - 30);
                break;
            case '90d':
                start.setDate(end.getDate() - 90);
                break;
            case '1y':
                start.setFullYear(end.getFullYear() - 1);
                break;
        }

        setDateRange({ start, end });
    };


    const handleRefresh = async () => {
        setLoading(true);
        try {
            const [products, tables, orders, orderDetails] = await Promise.all([
                authUtils.apiRequest('Sản phẩm', 'Find', {}),
                authUtils.apiRequest('DSBAN', 'Find', {}),
                authUtils.apiRequest('HOADON', 'Find', {}),
                authUtils.apiRequest('HOADONDETAIL', 'Find', {})
            ]);
            setAllData({ products, tables, orders, orderDetails });
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    };
    const processData = () => {
        try {
            const filteredOrders = allData.orders.filter(order => {
                const orderDate = new Date(order.Ngày);
                return orderDate >= dateRange.start && orderDate <= dateRange.end;
            });

            const totalRevenue = filteredOrders.reduce((sum, order) =>
                sum + (Number(order['Khách trả']) || 0), 0
            );
            // Add to processData function
            const salesByHour = filteredOrders.reduce((acc, order) => {
                const hour = new Date(order.Ngày).getHours();
                acc[hour] = (acc[hour] || 0) + Number(order['Khách trả'] || 0);
                return acc;
            }, {});

            const hourlyData = Array.from({ length: 24 }, (_, i) => ({
                hour: `${i}:00`,
                sales: salesByHour[i] || 0
            }));

            setAnalyticsData(prev => ({ ...prev, salesByHour: hourlyData }));
            const today = new Date().setHours(0, 0, 0, 0);
            const yesterday = new Date(today - 86400000).setHours(0, 0, 0, 0);

            const customersToday = allData.orders.filter(order => {
                const orderDate = new Date(order.Ngày).setHours(0, 0, 0, 0);
                return orderDate === today;
            }).length;

            const customersYesterday = allData.orders.filter(order => {
                const orderDate = new Date(order.Ngày).setHours(0, 0, 0, 0);
                return orderDate === yesterday;
            }).length;

            const customerPercentageChange = customersYesterday
                ? ((customersToday - customersYesterday) / customersYesterday) * 100
                : 0;

            setStats({
                products: allData.products.length,
                tables: allData.tables.length,
                orders: filteredOrders.length,
                revenue: totalRevenue,
                customersToday,
                customerPercentageChange: parseFloat(customerPercentageChange.toFixed(1))
            });

            const revenueByDate = filteredOrders.reduce((acc, order) => {
                const date = new Date(order.Ngày).toLocaleDateString('vi-VN');
                acc[date] = (acc[date] || 0) + Number(order['Khách trả'] || 0);
                return acc;
            }, {});

            const revenueData = Object.entries(revenueByDate)
                .map(([date, amount]) => ({
                    date,
                    revenue: amount
                }))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            const productSales = allData.orderDetails.reduce((acc, detail) => {
                acc[detail['Tên sản phẩm']] = (acc[detail['Tên sản phẩm']] || 0) +
                    Number(detail['Số lượng'] || 0);
                return acc;
            }, {});

            const productStats = Object.entries(productSales)
                .map(([name, quantity]) => ({
                    name,
                    quantity
                }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);

            const tableStats = allData.tables.map(table => {
                const tableOrders = filteredOrders.filter(order => order.IDBAN === table.IDBAN);
                const tableRevenue = tableOrders.reduce((sum, order) =>
                    sum + (Number(order['Khách trả']) || 0), 0
                );
                return {
                    name: table['Tên bàn'],
                    customers: tableOrders.length,
                    revenue: tableRevenue
                };
            }).sort((a, b) => b.customers - a.customers).slice(0, 5);

            const avgOrderValue = totalRevenue / filteredOrders.length;
            const paymentStats = {
                totalOrders: filteredOrders.length,
                totalRevenue,
                avgOrderValue
            };

            setAnalyticsData({
                revenueData,
                productStats,
                tableUsage: tableStats,
                paymentStats
            });
        } catch (error) {
            console.error('Error processing data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!allData.products.length) {
                    const [products, tables, orders, orderDetails] = await Promise.all([
                        authUtils.apiRequest('Sản phẩm', 'Find', {}),
                        authUtils.apiRequest('DSBAN', 'Find', {}),
                        authUtils.apiRequest('HOADON', 'Find', {}),
                        authUtils.apiRequest('HOADONDETAIL', 'Find', {})
                    ]);
                    setAllData({ products, tables, orders, orderDetails });
                }
                processData();
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [dateRange, allData]);

    const resetFilters = () => {
        setDateRange({
            start: new Date(new Date().setDate(new Date().getDate() - 30)),
            end: new Date()
        });
        setTimeFilter('30d');
    };

    const statCards = [
        {
            title: 'Tổng sản phẩm',
            value: stats?.products || 0,
            icon: UtensilsCrossed,
            color: 'bg-blue-500',
            isCurrency: false
        },
        {
            title: 'Số bàn',
            value: stats?.tables || 0,
            icon: TableIcon,
            color: 'bg-green-500',
            isCurrency: false
        },
        {
            title: 'Đơn hàng',
            value: stats?.orders || 0,
            icon: Receipt,
            color: 'bg-orange-500',
            isCurrency: false
        },
        {
            title: 'Doanh thu',
            value: stats?.revenue || 0,
            icon: TrendingUp,
            color: 'bg-red-500',
            isCurrency: true
        },
        {
            title: 'Khách hôm nay',
            value: stats?.customersToday || 0,
            icon: Users,
            color: 'bg-purple-500',
            percentageChange: stats?.customerPercentageChange,
            isCurrency: false
        }
    ];

    return (
        <div className="p-4 bg-gray-50 min-h-screen">
            <div className=" mx-auto space-y-4">
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">

                        <h1 className="text-2xl font-bold text-gray-900">
                            Tổng quan
                        </h1>

                        <div className="flex flex-wrap items-center gap-4">
                            <Button variant="outline" onClick={handleRefresh}>
                                <Loader2 className="w-4 h-4 mr-2" />
                                Làm mới
                            </Button>

                            <Button variant="outline" onClick={resetFilters}>
                                Reset
                            </Button>

                            <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
                                <SelectTrigger className="w-44">
                                    <Calendar className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="Chọn thời gian" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7d">7 ngày qua</SelectItem>
                                    <SelectItem value="30d">30 ngày qua</SelectItem>
                                    <SelectItem value="90d">90 ngày qua</SelectItem>
                                    <SelectItem value="1y">1 năm qua</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="flex gap-4">
                                <DatePicker
                                    selected={dateRange.start}
                                    onChange={(date) => setDateRange(prev => ({ ...prev, start: date }))}
                                    className="w-36"
                                    placeholderText="Từ ngày"
                                />
                                <DatePicker
                                    selected={dateRange.end}
                                    onChange={(date) => setDateRange(prev => ({ ...prev, end: date }))}
                                    className="w-36"
                                    placeholderText="Đến ngày"
                                />
                            </div>
                        </div>

                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {loading
                        ? Array(5).fill(0).map((_, i) => <StatCardSkeleton key={i} />)
                        : statCards.map((stat, index) => <StatCard key={index} {...stat} />)
                    }
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {loading ? (
                        <>
                            <ChartSkeleton height="h-72" />
                            <ChartSkeleton height="h-72" />
                            <ChartSkeleton height="h-72" />
                        </>
                    ) : (
                        <>
                            <Card className="lg:col-span-2">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-base font-semibold">
                                        Xu hướng doanh thu
                                    </CardTitle>
                                    <div className="flex gap-2">
                                        <Button
                                            variant={chartType === 'line' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setChartType('line')}
                                        >
                                            Line
                                        </Button>
                                        <Button
                                            variant={chartType === 'bar' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setChartType('bar')}
                                        >
                                            Bar
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            {chartType === 'line' ? (
                                                <LineChart data={analyticsData.revenueData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" />
                                                    <YAxis tickFormatter={formatCurrency} />
                                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                                    <Legend />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="revenue"
                                                        stroke="#0088FE"
                                                        name="Doanh thu"
                                                    />
                                                </LineChart>
                                            ) : (
                                                <BarChart data={analyticsData.revenueData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" />
                                                    <YAxis tickFormatter={formatCurrency} />
                                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                                    <Legend />
                                                    <Bar dataKey="revenue" fill="#0088FE" name="Doanh thu" />
                                                </BarChart>
                                            )}
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold">
                                        Top 5 sản phẩm bán chạy
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analyticsData.productStats}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <Tooltip />
                                                <Bar dataKey="quantity" fill="#00C49F" name="Số lượng" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold">
                                        Thống kê sử dụng bàn
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={analyticsData.tableUsage}
                                                    dataKey="customers"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    label={({ name, customers, revenue }) =>
                                                        `${name}: ${customers} ĐH | DT ${formatCurrency(revenue)}`}
                                                >
                                                    {analyticsData.tableUsage.map((entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={COLORS[index % COLORS.length]}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">
                            Tổng quan thanh toán
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-blue-600 font-medium">
                                    Tổng số đơn hàng
                                </p>
                                <p className="text-xl font-bold mt-1">
                                    {analyticsData.paymentStats.totalOrders}
                                </p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-green-600 font-medium">
                                    Tổng doanh thu
                                </p>
                                <p className="text-xl font-bold mt-1">
                                    {formatCurrency(analyticsData.paymentStats.totalRevenue)}
                                </p>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-lg">
                                <p className="text-sm text-orange-600 font-medium">
                                    Giá trị đơn trung bình
                                </p>
                                <p className="text-xl font-bold mt-1">
                                    {formatCurrency(analyticsData.paymentStats.avgOrderValue)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;