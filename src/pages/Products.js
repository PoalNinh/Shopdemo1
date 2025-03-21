import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash, Search, Image as ImageIcon, ChevronLeft, ChevronRight, Filter, Printer, Download, Check, Upload } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import authUtils from '../utils/authUtils';
import * as XLSX from 'xlsx';

const ProductManagement = () => {
    // State Management
    const [products, setProducts] = useState([]);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        category: '',
        status: '',
        priceRange: { min: '', max: '' }
    });
    const [imagePreview, setImagePreview] = useState('');
    const [currentProduct, setCurrentProduct] = useState({
        IDSP: '',
        'Tên sản phẩm': '',
        'Hình ảnh': '',
        'Loại sản phẩm': '',
        'Đơn vị tính': '',
        'Giá vốn': '',
        'Đơn giá': '',
        'Mô tả': '',
        'Trạng thái': 'Còn hàng'
    });
    // Add import states
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importPreview, setImportPreview] = useState([]);
    const [isImporting, setIsImporting] = useState(false);

    const getImageUrl = (imagePath) => {
        if (!imagePath) return '';

        // Trường hợp 1: Nếu là URL đầy đủ hoặc base64
        if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
            return imagePath;
        }

        // Trường hợp 2: Nếu là đường dẫn dạng ThuChi_Images/...
        if (imagePath.startsWith('Sản phẩm_Images/')) {
            const appName = encodeURIComponent('Quảnlýquáncafe-668554821');
            const tableName = encodeURIComponent('Sản phẩm');
            const fileName = encodeURIComponent(imagePath);

            return `https://www.appsheet.com/template/gettablefileurl?appName=${appName}&tableName=${tableName}&fileName=${fileName}`;
        }

        // Nếu là dạng khác, trả về đường dẫn gốc
        return imagePath;
    };

    // Component để hiển thị ảnh với fallback
    const ProductImage = ({ src, alt, className }) => {
        const [error, setError] = useState(false);

        if (!src || error) {
            return (
                <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                </div>
            );
        }

        // Nếu src là File object, hiển thị preview
        if (src instanceof File) {
            return (
                <img
                    src={imagePreview}
                    alt={alt}
                    className={className}
                    onError={() => setError(true)}
                />
            );
        }

        // Nếu là URL
        return (
            <img
                src={getImageUrl(src)}
                alt={alt}
                className={className}
                onError={() => setError(true)}
            />
        );
    };
    // Validation Function
    const validateProduct = (product) => {
        const errors = [];
        if (!product['Tên sản phẩm']) errors.push('Tên sản phẩm không được để trống');
        if (!product['Loại sản phẩm']) errors.push('Loại sản phẩm không được để trống');
        if (!product['Đơn vị tính']) errors.push('Đơn vị tính không được để trống');
        if (Number(product['Giá vốn']) < 0) errors.push('Giá vốn không được âm');
        if (Number(product['Đơn giá']) < 0) errors.push('Đơn giá không được âm');
        return errors;
    };

    // Fetch Products
    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await authUtils.apiRequest('Sản phẩm', 'Find', {});
            setProducts(response);
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('Lỗi khi tải danh sách sản phẩm');
        }
    };

    // Handle Product Modal
    const handleOpen = (product = null) => {
        if (product) {
            setCurrentProduct({
                IDSP: product.IDSP || '',
                'Tên sản phẩm': product['Tên sản phẩm'] || '',
                'Hình ảnh': product['Hình ảnh'] || '',
                'Loại sản phẩm': product['Loại sản phẩm'] || '',
                'Đơn vị tính': product['Đơn vị tính'] || '',
                'Giá vốn': product['Giá vốn'] || '',
                'Đơn giá': product['Đơn giá'] || '',
                'Mô tả': product['Mô tả'] || '',
                'Trạng thái': product['Trạng thái'] || 'Còn hàng'
            });
            setImagePreview(product['Hình ảnh'] || '');
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setCurrentProduct({
            IDSP: '',
            'Tên sản phẩm': '',
            'Hình ảnh': '',
            'Loại sản phẩm': '',
            'Đơn vị tính': '',
            'Giá vốn': '',
            'Đơn giá': '',
            'Mô tả': '',
            'Trạng thái': 'Còn hàng'
        });
        setImagePreview('');
    };

    // Handle Image Upload
    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Validate file
            const validation = authUtils.validateImage(file);
            if (!validation.isValid) {
                toast.error(validation.errors[0]);
                return;
            }

            // Chỉ tạo preview và lưu file để đợi upload
            const base64Preview = await authUtils.getImageAsBase64(file);
            setImagePreview(base64Preview);
            setCurrentProduct(prev => ({
                ...prev,
                'Hình ảnh': file // Lưu trực tiếp file thay vì tên file
            }));
        } catch (error) {
            console.error('Error handling image:', error);
            toast.error('Không thể đọc file ảnh');
            setImagePreview('');
            setCurrentProduct(prev => ({
                ...prev,
                'Hình ảnh': ''
            }));
        }
    };

    // Handle Form Input
    const handleInputChange = (field, value) => {
        setCurrentProduct(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Save Product
    const handleSave = async () => {
        if (isSubmitting) return;

        try {
            setIsSubmitting(true);
            const errors = validateProduct(currentProduct);
            if (errors.length > 0) {
                toast.error(errors.join('\n'));
                return;
            }

            let imageUrl = currentProduct['Hình ảnh'];

            // Kiểm tra nếu HÌNH ẢNH là File object (ảnh mới được chọn)
            if (currentProduct['Hình ảnh'] instanceof File) {
                toast.info('Đang tải ảnh lên...', { autoClose: false, toastId: 'uploadingImage' });
            
                try {
                    const uploadResult = await authUtils.uploadImage(currentProduct['Hình ảnh']);
                    if (!uploadResult.success) {
                        throw new Error('Upload failed');
                    }
                    imageUrl = uploadResult.url; // This is already correct, just ensure it matches
                    toast.dismiss('uploadingImage');
                } catch (error) {
                    toast.dismiss('uploadingImage');
                    toast.error('Không thể tải ảnh lên. Vui lòng thử lại.');
                    setIsSubmitting(false);
                    return;
                }
            }

            const productData = {
                ...currentProduct,
                'Hình ảnh': imageUrl,
                'Giá vốn': Number(currentProduct['Giá vốn']),
                'Đơn giá': Number(currentProduct['Đơn giá'])
            };

            if (productData.IDSP) {
                await authUtils.apiRequest('Sản phẩm', 'Edit', {
                    "Rows": [productData]
                });
                toast.success('Cập nhật sản phẩm thành công!');
            } else {
                const existingProducts = await authUtils.apiRequest('Sản phẩm', 'Find', {});
                const maxID = existingProducts.reduce((max, product) => {
                    const id = parseInt(product.IDSP.replace('SP', '')) || 0;
                    return id > max ? id : max;
                }, 0);

                const newID = maxID + 1;
                const newIDSP = `SP${newID.toString().padStart(3, '0')}`;
                productData.IDSP = newIDSP;

                await authUtils.apiRequest('Sản phẩm', 'Add', {
                    "Rows": [productData]
                });
                toast.success('Thêm sản phẩm thành công!');
            }

            await fetchProducts();
            handleClose();
        } catch (error) {
            console.error('Error saving product:', error);
            toast.error('Có lỗi xảy ra: ' + (error.message || 'Không thể lưu sản phẩm'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete Product
    const handleDelete = async (IDSP) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
            try {
                await authUtils.apiRequest('Sản phẩm', 'Delete', {
                    "Rows": [{ "IDSP": IDSP }]
                });
                toast.success('Xóa sản phẩm thành công!');
                await fetchProducts();
            } catch (error) {
                console.error('Error deleting product:', error);
                toast.error('Có lỗi xảy ra khi xóa sản phẩm');
            }
        }
    };

    // Bulk Actions
    const handleBulkDelete = async () => {
        if (selectedProducts.length === 0) {
            toast.warning('Vui lòng chọn sản phẩm để xóa');
            return;
        }

        if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedProducts.length} sản phẩm đã chọn?`)) {
            try {
                const deletePromises = selectedProducts.map(id =>
                    authUtils.apiRequest('Sản phẩm', 'Delete', {
                        "Rows": [{ "IDSP": id }]
                    })
                );

                await Promise.all(deletePromises);
                toast.success('Xóa sản phẩm thành công!');
                setSelectedProducts([]);
                await fetchProducts();
            } catch (error) {
                toast.error('Có lỗi xảy ra khi xóa sản phẩm');
            }
        }
    };

    const handleBulkPrint = (selectedProducts, products) => {
        if (selectedProducts.length === 0) {
            toast.warning('Vui lòng chọn sản phẩm để in nhãn');
            return;
        }

        const selectedItems = products.filter(p => selectedProducts.includes(p.IDSP));

        if (selectedItems.length > 25) {
            if (!window.confirm(`Bạn đã chọn ${selectedItems.length} nhãn. Việc in số lượng lớn có thể mất nhiều thời gian. Bạn có muốn tiếp tục không?`)) {
                return;
            }
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Vui lòng cho phép trình duyệt mở cửa sổ pop-up');
            return;
        }

        // Tạo nội dung HTML
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>In nhãn sản phẩm</title>
                <script src="https://unpkg.com/jsbarcode@latest/dist/JsBarcode.all.min.js"></script>
                <style>
                    @page {
                        size: 100mm 32.5mm;
                        margin: 0;
                    }
    
                    body {
                        margin: 0;
                        padding: 0;
                        width: 100mm;
                        font-family: Arial, sans-serif;
                    }
    
                    #printArea {
                        display: flex;
                        flex-wrap: wrap;
                    }
    
                    .print-label {
                        width: 50mm;
                        height: 32.5mm;
                        page-break-after: always;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        box-sizing: border-box;
                        padding: 2mm;
                    }
    
                    .label-title {
                        font-size: 13px;
                        font-weight: bold;
                        text-align: center;
                        margin-bottom: 2mm;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
    
                    .label-barcode {
                        text-align: center;
                        height: 15mm;
                        margin-bottom: 2mm;
                    }
    
                    .label-barcode svg {
                        max-width: 100%;
                        height: 100%;
                    }
    
                    .label-price {
                        font-size: 16px;
                        font-weight: bold;
                        text-align: center;
                    }
    
                    @media print {
                        body {
                            width: 100mm;
                        }
                        .print-label {
                            page-break-after: always;
                        }
                    }
                </style>
            </head>
            <body>
                <div id="printArea">
                    ${selectedItems.map((product, index) => `
                        <div class="print-label">
                            <div class="label-title">${product['Tên sản phẩm']}</div>
                            <div class="label-barcode">
                                <svg id="barcode${index}"></svg>
                            </div>
                            <div class="label-price">${Number(product['Đơn giá']).toLocaleString()} VNĐ</div>
                        </div>
                    `).join('')}
                </div>
                <script>
                    // Đợi cho đến khi JsBarcode được load hoàn toàn
                    function waitForJsBarcode(callback) {
                        if (window.JsBarcode) {
                            callback();
                        } else {
                            setTimeout(() => waitForJsBarcode(callback), 100);
                        }
                    }
    
                    // Tạo barcode cho từng sản phẩm
                    waitForJsBarcode(() => {
                        try {
                            ${selectedItems.map((product, index) => `
                                JsBarcode("#barcode${index}", "${product.IDSP}", {
                                    format: "CODE128",
                                    width: 1.5,
                                    height: 40,
                                    displayValue: true,
                                    fontSize: 8,
                                    marginTop: 5,
                                    marginBottom: 5,
                                    background: '#FFFFFF'
                                });
                            `).join('')}
    
                            // Đảm bảo tất cả SVG đã được render trước khi in
                            setTimeout(() => {
                                window.print();
                            }, 1000);
                        } catch (error) {
                            console.error('Error generating barcodes:', error);
                            alert('Có lỗi khi tạo mã vạch. Vui lòng thử lại.');
                        }
                    });
                </script>
            </body>
            </html>
        `;

        // Ghi nội dung HTML vào cửa sổ in
        printWindow.document.write(html);
        printWindow.document.close();
    };
    const handleExportSelected = () => {
        if (selectedProducts.length === 0) {
            toast.warning('Vui lòng chọn sản phẩm để xuất file');
            return;
        }

        const selectedItems = products.filter(p => selectedProducts.includes(p.IDSP));
        const csv = [
            ['IDSP', 'Tên sản phẩm', 'Loại sản phẩm', 'Đơn vị tính', 'Giá vốn', 'Đơn giá', 'Trạng thái'],
            ...selectedItems.map(item => [
                item.IDSP,
                item['Tên sản phẩm'],
                item['Loại sản phẩm'],
                item['Đơn vị tính'],
                item['Giá vốn'],
                item['Đơn giá'],
                item['Trạng thái']
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `san-pham-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    // Filtering and Pagination
    const filteredProducts = products.filter(product => {
        const matchesSearch =
            product['Tên sản phẩm']?.toLowerCase().includes(search.toLowerCase()) ||
            product.IDSP?.toLowerCase().includes(search.toLowerCase());

        const matchesCategory = !filters.category || product['Loại sản phẩm'] === filters.category;
        const matchesStatus = !filters.status || product['Trạng thái'] === filters.status;
        const matchesPriceRange = (
            (!filters.priceRange.min || Number(product['Đơn giá']) >= Number(filters.priceRange.min)) &&
            (!filters.priceRange.max || Number(product['Đơn giá']) <= Number(filters.priceRange.max))
        );

        return matchesSearch && matchesCategory && matchesStatus && matchesPriceRange;
    });

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    // Import Excel functionality
    const handleImportFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Check if file is Excel
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(fileExtension)) {
            toast.error('Vui lòng chọn file Excel (.xlsx, .xls) hoặc CSV');
            return;
        }
        
        setImportFile(file);
        
        // Parse Excel file for preview
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const binaryData = evt.target.result;
                const workbook = XLSX.read(binaryData, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON with headers
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length < 2) {
                    toast.error('File không có dữ liệu hoặc không đúng định dạng');
                    setImportFile(null);
                    return;
                }
                
                // Extract headers and data
                const headers = jsonData[0];
                const requiredColumns = ['Tên sản phẩm', 'Loại sản phẩm', 'Đơn vị tính', 'Giá vốn', 'Đơn giá'];
                
                // Check if all required columns exist
                const missingColumns = requiredColumns.filter(col => !headers.includes(col));
                if (missingColumns.length > 0) {
                    toast.error(`File thiếu các cột bắt buộc: ${missingColumns.join(', ')}`);
                    setImportFile(null);
                    return;
                }
                
                // Create preview data (first 5 rows)
                const previewData = jsonData.slice(1, 6).map(row => {
                    const rowData = {};
                    headers.forEach((header, index) => {
                        rowData[header] = row[index] || '';
                    });
                    return rowData;
                });
                
                setImportPreview(previewData);
            } catch (error) {
                console.error('Error parsing Excel file:', error);
                toast.error('Không thể đọc file. Vui lòng kiểm tra định dạng file.');
                setImportFile(null);
            }
        };
        
        reader.onerror = () => {
            toast.error('Không thể đọc file');
            setImportFile(null);
        };
        
        reader.readAsBinaryString(file);
    };

    const handleImportData = async () => {
        if (!importFile) return;
        
        setIsImporting(true);
        toast.info('Đang xử lý dữ liệu...', { autoClose: false, toastId: 'importing' });
        
        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const binaryData = evt.target.result;
                    const workbook = XLSX.read(binaryData, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // Convert to JSON with headers
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    // Validate data
                    const invalidRows = [];
                    const validatedData = [];
                    
                    // Get existing products for ID generation
                    const existingProducts = await authUtils.apiRequest('Sản phẩm', 'Find', {});
                    const maxID = existingProducts.reduce((max, product) => {
                        const id = parseInt(product.IDSP.replace('SP', '')) || 0;
                        return id > max ? id : max;
                    }, 0);
                    
                    let newIdCounter = maxID + 1;
                    
                    // Process each row
                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        
                        // Basic validation
                        if (!row['Tên sản phẩm'] || !row['Loại sản phẩm'] || !row['Đơn vị tính']) {
                            invalidRows.push(i + 2); // +2 because of 0-indexing and header row
                            continue;
                        }
                        
                        // Create product object
                        const product = {
                            IDSP: row.IDSP || `SP${newIdCounter.toString().padStart(3, '0')}`,
                            'Tên sản phẩm': row['Tên sản phẩm'],
                            'Loại sản phẩm': row['Loại sản phẩm'],
                            'Đơn vị tính': row['Đơn vị tính'],
                            'Giá vốn': Number(row['Giá vốn'] || 0),
                            'Đơn giá': Number(row['Đơn giá'] || 0),
                            'Mô tả': row['Mô tả'] || '',
                            'Trạng thái': row['Trạng thái'] || 'Còn hàng',
                            'Hình ảnh': row['Hình ảnh'] || ''
                        };
                        
                        validatedData.push(product);
                        newIdCounter++;
                    }
                    
                    if (invalidRows.length > 0) {
                        toast.warning(`Có ${invalidRows.length} dòng dữ liệu không hợp lệ: ${invalidRows.join(', ')}`);
                    }
                    
                    if (validatedData.length === 0) {
                        toast.error('Không có dữ liệu hợp lệ để nhập');
                        setIsImporting(false);
                        toast.dismiss('importing');
                        return;
                    }
                    
                    // Import products in batches to avoid timeout
                    const batchSize = 25;
                    let successCount = 0;
                    
                    for (let i = 0; i < validatedData.length; i += batchSize) {
                        const batch = validatedData.slice(i, i + batchSize);
                        try {
                            await authUtils.apiRequest('Sản phẩm', 'Add', {
                                "Rows": batch
                            });
                            successCount += batch.length;
                        } catch (error) {
                            console.error('Error importing batch:', error);
                        }
                    }
                    
                    toast.dismiss('importing');
                    toast.success(`Đã nhập thành công ${successCount} sản phẩm`);
                    await fetchProducts();
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportPreview([]);
                } catch (error) {
                    console.error('Error processing import:', error);
                    toast.dismiss('importing');
                    toast.error('Có lỗi xảy ra khi xử lý dữ liệu');
                } finally {
                    setIsImporting(false);
                }
            };
            
            reader.onerror = () => {
                toast.dismiss('importing');
                toast.error('Không thể đọc file');
                setIsImporting(false);
            };
            
            reader.readAsBinaryString(importFile);
        } catch (error) {
            toast.dismiss('importing');
            toast.error('Có lỗi xảy ra');
            setIsImporting(false);
        }
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            ['Tên sản phẩm', 'Loại sản phẩm', 'Đơn vị tính', 'Giá vốn', 'Đơn giá', 'Mô tả', 'Trạng thái', 'Hình ảnh'],
            ['Cà phê sữa', 'Đồ uống', 'Ly', '15000', '25000', 'Cà phê sữa đá', 'Còn hàng', ''],
            ['Bạc xỉu', 'Đồ uống', 'Ly', '18000', '30000', 'Bạc xỉu đá', 'Còn hàng', '']
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        
        // Generate file
        XLSX.writeFile(wb, 'mau_nhap_san_pham.xlsx');
    };

    // Pagination Component
    const Pagination = () => {
        return (
            <div className="flex flex-wrap justify-center items-center space-x-1 md:space-x-2 mt-4">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50'}`}
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                        <button
                            key={number}
                            onClick={() => handlePageChange(number)}
                            className={`px-3 py-1 rounded-lg ${currentPage === number ? 'bg-blue-500 text-white'
                                : 'text-gray-600 hover:bg-blue-50'
                                }`}
                        >
                            {number}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50'}`}
                >
                    <ChevronRight className="h-5 w-5" />
                </button>

                <span className="text-gray-600 ml-4">
                    Trang {currentPage} / {totalPages || 1}
                </span>
            </div>
        );
    };

    return (
        <div className="p-3 md:p-6 bg-gray-50 min-h-screen">
            <div className="bg-white rounded-lg shadow-sm p-3 md:p-6 mb-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-3 md:space-y-0">
                    <h1 className="text-xl md:text-2xl font-semibold text-gray-800">Quản lý Sản phẩm</h1>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                            <Filter className="w-4 h-4" />
                            Bộ lọc
                        </button>
                        
                        {/* Import button */}
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            Nhập Excel
                        </button>
                        
                        {selectedProducts.length > 0 && (
                            <>
                                <button
                                    onClick={() => handleBulkPrint(selectedProducts, products)}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                                    disabled={selectedProducts.length === 0}
                                >
                                    <Printer className="w-4 h-4" />
                                    In nhãn ({selectedProducts.length})
                                </button>
                                <button
                                    onClick={handleExportSelected}
                                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Xuất file
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                                >
                                    <Trash className="w-4 h-4" />
                                    Xóa ({selectedProducts.length})
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => handleOpen()}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Thêm Sản phẩm
                        </button>
                    </div>
                </div>

                {/* Filter Section */}
                {showFilters && (
                    <div className="mb-4 p-3 md:p-4 border rounded-lg bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <select
                                value={filters.category}
                                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                                className="p-2 border rounded-lg"
                            >
                                <option value="">Tất cả loại SP</option>
                                {Array.from(new Set(products.map(p => p['Loại sản phẩm']))).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="p-2 border rounded-lg"
                            >
                                <option value="">Tất cả trạng thái</option>
                                <option value="Còn hàng">Còn hàng</option>
                                <option value="Hết hàng">Hết hàng</option>
                            </select>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number"
                                    placeholder="Giá từ"
                                    value={filters.priceRange.min}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        priceRange: { ...filters.priceRange, min: e.target.value }
                                    })}
                                    className="p-2 border rounded-lg w-full"
                                />
                                <span>-</span>
                                <input
                                    type="number"
                                    placeholder="Giá đến"
                                    value={filters.priceRange.max}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        priceRange: { ...filters.priceRange, max: e.target.value }
                                    })}
                                    className="p-2 border rounded-lg w-full"
                                />
                            </div>
                            <button
                                onClick={() => setFilters({
                                    category: '',
                                    status: '',
                                    priceRange: { min: '', max: '' }
                                })}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
                            >
                                Xóa bộ lọc
                            </button>
                        </div>
                    </div>
                )}

                {/* Search Section */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo mã hoặc tên sản phẩm..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Table Section */}
                <div className="overflow-x-auto -mx-3 md:mx-0">
                <table className="w-full min-w-[800px]"> 
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-4 py-3 border-b">
                                    <input
                                        type="checkbox"
                                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedProducts(filteredProducts.map(p => p.IDSP));
                                            } else {
                                                setSelectedProducts([]);
                                            }
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="px-4 py-3 border-b text-left text-sm font-medium text-gray-600">IDSP</th>
                                <th className="px-4 py-3 border-b text-left text-sm font-medium text-gray-600">Tên sản phẩm</th>
                                <th className="px-4 py-3 border-b text-left text-sm font-medium text-gray-600">Hình ảnh</th>
                                <th className="px-4 py-3 border-b text-left text-sm font-medium text-gray-600">Loại SP</th>
                                <th className="px-4 py-3 border-b text-left text-sm font-medium text-gray-600">ĐVT</th>
                                <th className="px-4 py-3 border-b text-left text-sm font-medium text-gray-600">Giá vốn</th>
                                <th className="px-4 py-3 border-b text-left text-sm font-medium text-gray-600">Đơn giá</th>
                                <th className="px-4 py-3 border-b text-left text-sm font-medium text-gray-600">Mô tả</th>
                                <th className="px-4 py-3 border-b text-left text-sm font-medium text-gray-600">Trạng thái</th>
                                <th className="px-4 py-3 border-b text-right text-sm font-medium text-gray-600">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentItems.map((product) => (
                                <tr key={product.IDSP} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 border-b">
                                        <input
                                            type="checkbox"
                                            checked={selectedProducts.includes(product.IDSP)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedProducts([...selectedProducts, product.IDSP]);
                                                } else {
                                                    setSelectedProducts(selectedProducts.filter(id => id !== product.IDSP));
                                                }
                                            }}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 border-b">{product.IDSP}</td>
                                    <td className="px-4 py-3 border-b">{product['Tên sản phẩm']}</td>
                                    <td className="px-4 py-3 border-b">
                                        <ProductImage
                                            src={product['Hình ảnh']}
                                            alt={product['Tên sản phẩm']}
                                            className="w-12 h-12 object-cover rounded-lg"
                                        />
                                    </td>
                                    <td className="px-4 py-3 border-b">{product['Loại sản phẩm']}</td>
                                    <td className="px-4 py-3 border-b">{product['Đơn vị tính']}</td>
                                    <td className="px-4 py-3 border-b">
                                        {(Number(product['Giá vốn']) || 0).toLocaleString()}đ
                                    </td>
                                    <td className="px-4 py-3 border-b">
                                        {(Number(product['Đơn giá']) || 0).toLocaleString()}đ
                                    </td>
                                    <td className="px-4 py-3 border-b">{product['Mô tả']}</td>
                                    <td className="px-4 py-3 border-b">
                                        <span className={`px-2 py-1 rounded-full text-sm ${product['Trạng thái'] === 'Còn hàng'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {product['Trạng thái']}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 border-b text-right">
                                        <button
                                            onClick={() => handleOpen(product)}
                                            className="text-blue-500 hover:text-blue-700 p-1"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(product.IDSP)}
                                            className="text-red-500 hover:text-red-700 p-1 ml-1"
                                        >
                                            <Trash className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <Pagination />
            </div>

            {/* Modal Add/Edit Product */}
            {open && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-4 md:p-6">
                  <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold">
                                {currentProduct.IDSP ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}
                            </h2>
                            <button
                                onClick={handleClose}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    placeholder="Tên sản phẩm"
                                    className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={currentProduct['Tên sản phẩm']}
                                    onChange={(e) => handleInputChange('Tên sản phẩm', e.target.value)}
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Loại sản phẩm"
                                    className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={currentProduct['Loại sản phẩm']}
                                    onChange={(e) => handleInputChange('Loại sản phẩm', e.target.value)}
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Đơn vị tính"
                                    className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={currentProduct['Đơn vị tính']}
                                    onChange={(e) => handleInputChange('Đơn vị tính', e.target.value)}
                                    required
                                />
                                <input
                                    type="number"
                                    placeholder="Giá vốn"
                                    className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={currentProduct['Giá vốn']}
                                    onChange={(e) => handleInputChange('Giá vốn', e.target.value)}
                                    min="0"
                                    required
                                />
                                <input
                                    type="number"
                                    placeholder="Đơn giá"
                                    className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={currentProduct['Đơn giá']}
                                    onChange={(e) => handleInputChange('Đơn giá', e.target.value)}
                                    min="0"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageChange}
                                    />
                                    <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                                        <ImageIcon className="h-4 w-4" />
                                        <span>Chọn hình ảnh</span>
                                    </div>
                                </label>
                                {(imagePreview || currentProduct['Hình ảnh']) && (
                                    <div className="relative w-32 h-32">
                                        <ProductImage
                                            src={imagePreview || currentProduct['Hình ảnh']}
                                            alt="Preview"
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                        <button
                                            onClick={() => {
                                                setImagePreview('');
                                                setCurrentProduct(prev => ({ ...prev, 'Hình ảnh': '' }));
                                            }}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>

                            <textarea
                                placeholder="Mô tả"
                                rows={4}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={currentProduct['Mô tả']}
                                onChange={(e) => handleInputChange('Mô tả', e.target.value)}
                            />

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="status"
                                        className="text-blue-500 focus:ring-blue-500"
                                        checked={currentProduct['Trạng thái'] === 'Còn hàng'}
                                        onChange={() => handleInputChange('Trạng thái', 'Còn hàng')}
                                    />
                                    <span>Còn hàng</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="status"
                                        className="text-blue-500 focus:ring-blue-500"
                                        checked={currentProduct['Trạng thái'] === 'Hết hàng'}
                                        onChange={() => handleInputChange('Trạng thái', 'Hết hàng')}
                                    />
                                    <span>Hết hàng</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    disabled={isSubmitting}
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSubmitting}
                                    className={`px-4 py-2 bg-blue-500 text-white rounded-lg ${isSubmitting
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:bg-blue-600'
                                        } flex items-center gap-2`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Đang lưu...
                                        </>
                                    ) : 'Lưu'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Excel Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-4 md:p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Nhập sản phẩm từ Excel</h2>
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    setImportFile(null);
                                    setImportPreview([]);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Tải lên file Excel (.xlsx, .xls) hoặc CSV có chứa dữ liệu sản phẩm.
                                File cần có các cột: Tên sản phẩm, Loại sản phẩm, Đơn vị tính, Giá vốn, Đơn giá.
                            </p>
                            <div className="flex gap-2">
                                <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                        onChange={handleImportFileChange}
                                    />
                                    <Upload className="h-4 w-4" />
                                    <span>Chọn file</span>
                                </label>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="px-4 py-2 text-blue-500 border border-blue-500 rounded-lg hover:bg-blue-50 flex items-center gap-2"
                                >
                                    <Download className="h-4 w-4" />
                                    Tải mẫu nhập
                                </button>
                            </div>
                            {importFile && (
                                <div className="mt-2 text-sm text-gray-600">
                                    Đã chọn: {importFile.name} ({(importFile.size / 1024).toFixed(2)} KB)
                                </div>
                            )}
                        </div>
                        
                        {importPreview.length > 0 && (
                            <div className="mb-4">
                                <h3 className="font-medium mb-2">Xem trước dữ liệu (5 dòng đầu tiên):</h3>
                                <div className="overflow-x-auto border rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                {Object.keys(importPreview[0]).map((header, index) => (
                                                    <th key={index} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {importPreview.map((row, rowIndex) => (
                                                <tr key={rowIndex}>
                                                    {Object.values(row).map((cell, cellIndex) => (
                                                        <td key={cellIndex} className="px-3 py-2 text-sm text-gray-500 truncate">
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    setImportFile(null);
                                    setImportPreview([]);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                disabled={isImporting}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleImportData}
                                disabled={!importFile || isImporting}
                                className={`px-4 py-2 bg-blue-500 text-white rounded-lg ${(!importFile || isImporting)
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-blue-600'
                                    } flex items-center gap-2`}
                            >
                                {isImporting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Đang nhập...
                                    </>
                                ) : 'Nhập dữ liệu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Container */}
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
        </div>
    );
};

export default ProductManagement;