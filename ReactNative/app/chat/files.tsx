import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { getRoomFiles, FileItem } from '../../api/chat';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';
import { API_BASE_URL } from '../../api/client';

export default function FilesScreen() {
    const { roomId } = useLocalSearchParams<{ roomId: string }>();
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadFiles();
    }, [roomId]);

    const loadFiles = async () => {
        if (!roomId) return;

        try {
            setIsLoading(true);
            const result = await getRoomFiles(Number(roomId));
            setFiles(Array.isArray(result) ? result : []);
        } catch (error) {
            console.error('Failed to load files:', error);
            Alert.alert('오류', '파일 목록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async (file: FileItem) => {
        try {
            const fileUrl = file.FILE_URL.startsWith('http')
                ? file.FILE_URL
                : `${API_BASE_URL}${file.FILE_URL}`;

            const supported = await Linking.canOpenURL(fileUrl);
            if (supported) {
                await Linking.openURL(fileUrl);
            } else {
                Alert.alert('오류', '파일을 열 수 없습니다.');
            }
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert('오류', '파일 다운로드에 실패했습니다.');
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getFileIcon = (fileName: string): string => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
        if (['pdf'].includes(ext)) return '📄';
        if (['doc', 'docx'].includes(ext)) return '📝';
        if (['xls', 'xlsx'].includes(ext)) return '📊';
        if (['zip', 'rar', '7z'].includes(ext)) return '📦';
        if (['mp4', 'avi', 'mov'].includes(ext)) return '🎬';
        if (['mp3', 'wav'].includes(ext)) return '🎵';
        return '📁';
    };

    const renderFile = ({ item }: { item: FileItem }) => (
        <TouchableOpacity
            style={styles.fileItem}
            onPress={() => handleDownload(item)}
        >
            <Text style={styles.fileIcon}>{getFileIcon(item.FILE_NAME)}</Text>
            <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{item.FILE_NAME}</Text>
                <Text style={styles.fileMeta}>
                    {formatFileSize(item.FILE_SIZE)} · {formatDate(item.CREATED_AT)}
                </Text>
            </View>
            <Text style={styles.downloadIcon}>⬇️</Text>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    title: `파일 (${files.length}개)`,
                    headerStyle: { backgroundColor: Colors.primary },
                    headerTintColor: Colors.textInverse,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Text style={{ color: Colors.textInverse, fontSize: 16 }}>← 뒤로</Text>
                        </TouchableOpacity>
                    ),
                }}
            />
            <View style={styles.container}>
                <FlatList
                    data={files}
                    renderItem={renderFile}
                    keyExtractor={(item) => String(item.FILE_ID || item.MSG_ID)}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📂</Text>
                            <Text style={styles.emptyText}>공유된 파일이 없습니다.</Text>
                        </View>
                    }
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgPage,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: Spacing.md,
        flexGrow: 1,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.bgCard,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
    },
    fileIcon: {
        fontSize: 32,
        marginRight: Spacing.md,
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        fontSize: FontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    fileMeta: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    downloadIcon: {
        fontSize: 20,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: Spacing.md,
    },
    emptyText: {
        color: Colors.textMuted,
        fontSize: FontSize.base,
    },
});
