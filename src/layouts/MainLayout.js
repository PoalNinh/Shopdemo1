import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    UtensilsCrossed,
    Table,
    Receipt,
    User,
    Wallet,
    ChevronLeft,
    LogOut,
    Menu as MenuIcon,
    X
} from 'lucide-react';
import authUtils from '../utils/authUtils';

const isMobileDevice = () => {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const MainLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Initialize sidebar state based on screen size - open by default on desktop, closed on mobile
    const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobileDevice());
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(isMobileDevice());
    
    // State để lưu các nút chức năng đặc biệt từ trang con
    const [pageActions, setPageActions] = useState([]);

    const userData = authUtils.getUserData();

    // Add resize listener
    useEffect(() => {
        const handleResize = () => {
            const mobile = isMobileDevice();
            setIsMobile(mobile);
            
            // Automatically close sidebar on mobile when resizing
            if (mobile && isSidebarOpen) {
                setIsSidebarOpen(false);
            } else if (!mobile && !isSidebarOpen) {
                setIsSidebarOpen(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isSidebarOpen]);

    // Tạo phương thức để các trang con có thể đăng ký nút
    // Đính kèm phương thức này vào window để các component con có thể truy cập
    useEffect(() => {
        window.registerPageActions = (actions) => {
            setPageActions(actions);
        };
        
        window.clearPageActions = () => {
            setPageActions([]);
        };
        
        return () => {
            delete window.registerPageActions;
            delete window.clearPageActions;
        };
    }, []);

    // Close profile menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isProfileMenuOpen && !event.target.closest('.profile-menu-container')) {
                setIsProfileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isProfileMenuOpen]);

    const menuItems = [
        { text: 'Tổng quan', icon: LayoutDashboard, path: '/dashboard' },
        {
            text: 'POS',
            icon: UtensilsCrossed,
            path: isMobile ? '/pos' : '/posPC',
            isExternal: true,
            requiresUserParam: true
        },
        { text: 'Quản lý sản phẩm', icon: UtensilsCrossed, path: '/products' },
        { text: 'Quản lý bàn', icon: Table, path: '/tables' },
       
        {
            text: 'Quản lý hóa đơn',
            icon: UtensilsCrossed,
            path: isMobile ? '/mobileorders' : '/orders',
            isExternal: true,
            requiresUserParam: true
        },
      
        { text: 'Quản lý người dùng', icon: User, path: '/users' },
        { text: 'Đăng xuất', icon: LogOut, path: '/', isLogout: true }
    ];

    const handleLogout = () => {
        authUtils.logout();
        navigate('/');
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const userInitial = userData?.username?.[0]?.toUpperCase() || '?';

    const Sidebar = () => (
        <div className="flex flex-col h-full bg-white">
            {/* Logo & Brand */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
                <h1 className="text-xl font-semibold text-gray-800">
                    Quản lý nhà hàng
                </h1>
                <button
                    className="text-gray-500 hover:text-gray-700"
                    onClick={toggleSidebar}
                >
                    <X className="h-6 w-6" />
                </button>
            </div>

            {/* User Info */}
            <div className="px-6 py-4 border-b">
                <div
                    className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
                    onClick={() => {
                        navigate('/profile');
                        isMobile && setIsSidebarOpen(false);
                    }}
                >
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                        {userInitial}
                    </div>
                    <div>
                        <p className="font-medium text-gray-800">
                            {userData?.['Họ và Tên'] || userData?.username}
                        </p>
                        <p className="text-sm text-gray-500">
                            {userData?.['Chức vụ'] || 'Nhân viên'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <button
                            key={item.text}
                            onClick={() => {
                                if (item.isLogout) {
                                    handleLogout();
                                }
                                else if (item.isExternal) {
                                    if (item.requiresUserParam && userData) {
                                        const finalUrl = `${item.path}`;
                                        window.location.href = finalUrl;
                                    } else {
                                        window.open(item.path, '_blank');
                                    }
                                } else {
                                    navigate(item.path);
                                }
                                isMobile && setIsSidebarOpen(false);
                            }}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                                isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <Icon className={`h-5 w-5 ${isActive ? 'text-blue-500' : 'text-gray-500'}`} />
                            <span className={`font-medium ${isActive ? 'text-blue-600' : 'text-gray-700'}`}>
                                {item.text}
                            </span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Mobile Sidebar Backdrop */}
            {isSidebarOpen && isMobile && (
                <div
                    className="fixed inset-0 bg-gray-800/50 z-40"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <aside 
                className={`fixed top-0 left-0 h-full transform transition-transform duration-200 ease-in-out z-50 
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-lg`}
                style={{ width: '18rem' }}
            >
                <Sidebar />
            </aside>

            {/* Main Content */}
            <div className={`transition-all duration-200 ${isSidebarOpen ? 'lg:pl-72' : 'pl-0'}`}>
                {/* Header */}
                <header className={`fixed top-0 right-0 left-0 ${isSidebarOpen ? 'lg:left-72' : 'left-0'} z-20 transition-all duration-200`}>
                    <div className="h-16 bg-white border-b px-4 flex items-center justify-between shadow-sm">
                        {/* Sidebar Toggle */}
                        <div className="flex items-center space-x-2">
                            <button
                                className="text-gray-500 hover:text-gray-700"
                                onClick={toggleSidebar}
                                aria-label={isSidebarOpen ? "Đóng menu" : "Mở menu"}
                            >
                                {isSidebarOpen ? <ChevronLeft className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
                            </button>
                            
                            {/* Page title based on current route */}
                            <h2 className="text-lg font-medium hidden md:block">
                                {menuItems.find(item => item.path === location.pathname)?.text || 'Trang chủ'}
                            </h2>
                        </div>
                        
                        {/* Các nút tùy chỉnh từ trang con */}
                        <div className="flex-1 flex justify-center">
                            <div className="flex items-center space-x-2 overflow-x-auto max-w-[90%] px-4">
                                {pageActions.map((action, index) => (
                                    action.component ? (
                                        <div key={index} className="flex-shrink-0">
                                            {action.component}
                                        </div>
                                    ) : (
                                        <button
                                            key={index}
                                            onClick={action.onClick}
                                            className={`${action.className || 'px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600'} flex items-center space-x-1 flex-shrink-0`}
                                            title={action.title || action.text}
                                            disabled={action.disabled}
                                        >
                                            {action.icon && action.icon}
                                            <span className={isMobile && action.text ? 'hidden sx:inline' : ''}>
                                                {action.text}
                                            </span>
                                        </button>
                                    )
                                ))}
                            </div>
                        </div>

                        {/* User Menu */}
                        <div className="relative profile-menu-container">
                            <button
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg p-2"
                                aria-label="Menu người dùng"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                                    {userInitial}
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            {isProfileMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                                    <button
                                        onClick={() => {
                                            navigate('/profile');
                                            setIsProfileMenuOpen(false);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                    >
                                        <User className="h-4 w-4" />
                                        <span>Thông tin cá nhân</span>
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span>Đăng xuất</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className={`pt-16 transition-all duration-200`}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;