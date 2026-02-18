"use client"

/* eslint-disable @next/next/no-img-element */

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { X, Upload, Plus } from "lucide-react"

interface ComparisonViewProps {
  onClose: () => void
}

interface ImageItem {
  id: string
  url: string
  name: string
}

const ComparisonView = ({ onClose }: ComparisonViewProps) => {
  const [images, setImages] = useState<ImageItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsLoading(true)
    const newImages: ImageItem[] = []

    let loadedCount = 0
    const totalFiles = files.length

    Array.from(files).forEach((file) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        if (e.target?.result) {
          newImages.push({
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: e.target.result as string,
            name: file.name,
          })
        }

        loadedCount++
        if (loadedCount === totalFiles) {
          setImages((prev) => [...prev, ...newImages])
          setIsLoading(false)
        }
      }

      reader.onerror = () => {
        console.error(`ファイル ${file.name} の読み込み中にエラーが発生しました`)
        loadedCount++
        if (loadedCount === totalFiles) {
          setIsLoading(false)
        }
      }

      reader.readAsDataURL(file)
    })

    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }

  return (
    <div className="fixed inset-0 bg-white z-[3000] overflow-auto p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">校区比較検討</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <span>読み込み中...</span>
            ) : (
              <>
                <Plus size={16} />
                <Upload size={16} className="mr-1" />
                画像を追加
              </>
            )}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            multiple
            className="hidden"
          />
          <p className="text-sm text-gray-500 mt-2">
            「画像保存」ボタンで保存した地図画像をアップロードして比較できます
          </p>
        </div>

        {images.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <p className="text-gray-500">画像をアップロードして比較を開始してください</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {images.map((image) => (
              <div key={image.id} className="relative border rounded-lg overflow-hidden">
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => removeImage(image.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-2 bg-gray-100 border-b">
                  <p className="text-sm font-medium truncate">{image.name}</p>
                </div>
                <div className="p-2 h-[500px] overflow-auto">
                  <img
                    src={image.url || "/placeholder.svg"}
                    alt={image.name}
                    className="w-full h-auto object-contain"
                    onError={(e) => {
                      console.error(`画像の表示中にエラーが発生しました: ${image.name}`)
                      e.currentTarget.onerror = null
                      e.currentTarget.src =
                        "data:image/svg+xml;charset=utf-8," +
                        encodeURIComponent(
                          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="14">画像を表示できません</text></svg>',
                        )
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ComparisonView
