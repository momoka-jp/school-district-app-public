import type { GeoJSONData, SchoolGeoJSONData, DisplayMode, DistrictOptionValue } from "@/types/map-types"

export const getTimestamp = (): string => {
	const now = new Date()
	const year = now.getFullYear()
	const month = String(now.getMonth() + 1).padStart(2, "0")
	const date = String(now.getDate()).padStart(2, "0")
	const hours = String(now.getHours()).padStart(2, "0")
	const minutes = String(now.getMinutes()).padStart(2, "0")
	const seconds = String(now.getSeconds()).padStart(2, "0")
	return `${year}${month}${date}_${hours}${minutes}${seconds}`
}

export const isSchoolSelectable = (
	schoolName: string,
	isClosed: boolean,
	selectedMode: "Name_1" | "Name_2",
): boolean => {
	if (isClosed) return false

	if (selectedMode === "Name_1") {
		return schoolName.endsWith("小学校")
	} else {
    return schoolName.endsWith("中学校")
	}
}

type SchoolCategory = "elementary" | "middle" | "other"

const getSchoolCategory = (name: string): SchoolCategory => {
	const normalized = String(name ?? "")
	if (normalized.endsWith("小学校")) return "elementary"
	if (normalized.endsWith("中学校")) return "middle"
	return "other"
}

const evaluateClosureState = (
	props: SchoolGeoJSONData["features"][number]["properties"],
	assignedSho: number,
	assignedChu: number,
	options: { forceAutoClosure?: boolean } = {},
) => {
	const { forceAutoClosure = false } = options

	const category = getSchoolCategory(props?.name ?? "")
	const manualClosed = Boolean(props?.isClosedManual)

	if (manualClosed) {
		props.isClosed = true
		props.closedByOptimization = false
		props.manualOpenOverride = false
		return
	}

	const primaryCount =
		category === "elementary"
			? assignedSho
			: category === "middle"
				? assignedChu
				: assignedSho + assignedChu

	if (props?.manualOpenOverride) {
		if (primaryCount > 0) {
			props.manualOpenOverride = false
		} else if (!forceAutoClosure) {
			props.isClosed = false
			props.closedByOptimization = false
			return
		} else {
			props.manualOpenOverride = false
		}
	}

	if (primaryCount === 0) {
		props.isClosed = true
		props.closedByOptimization = true
		props.manualOpenOverride = false
	} else {
		props.isClosed = false
		props.closedByOptimization = false
		props.manualOpenOverride = false
	}
}

export const calculateSchoolEnrollment = (
	districtData: GeoJSONData,
	schoolData: SchoolGeoJSONData,
	mode: "Name_1" | "Name_2",
	displayMode: DisplayMode,
	year: number,
	options: { forceAutoClosure?: boolean } = {},
) => {
	const resolvedYear = typeof year === "number" ? year : 2024
	const { forceAutoClosure = false } = options

	const resolveSchoolName = (district: GeoJSONData["features"][number]) => {
		const props = district?.properties ?? {}
		const baseName = props[mode]

		if (displayMode === "original") {
			return props.originalDistricts?.[mode] ?? baseName
		}
		if (displayMode === "current") {
			return props.editedDistricts?.[mode] ?? baseName
		}
		if (displayMode === "optimized") {
			return props.optimizedDistricts?.[mode] ?? props.editedDistricts?.[mode] ?? baseName
		}
		return props.editedDistricts?.[mode] ?? baseName
	}

	console.log(` calculateSchoolEnrollment開始`, {
		mode: mode === "Name_1" ? "小学校" : "中学校",
    	displayMode,
    	selectedYear: resolvedYear,
		districtCount: districtData?.features?.length,
		schoolCount: schoolData?.features?.length,
	})

	// データの健全性チェックを追加
	if (!districtData?.features || !Array.isArray(districtData.features)) {
		console.warn("地区データが不完全です:", districtData)
		return
	}
	if (!schoolData?.features || !Array.isArray(schoolData.features)) {
		console.warn("学校データが不完全です:", schoolData)
		return
	}

	// プロパティ初期化（すべての学校の生徒数を0にリセット）
	schoolData.features.forEach((school) => {
		if (mode === "Name_1") {
			school.properties.assignedStudentsSho = 0
		} else if (mode === "Name_2") {
			school.properties.assignedStudentsChu = 0
		}
	})

	let debugCount = 0
	const maxDebugLogs = 10 // デバッグログの件数を増やす

	// 各地区から学校への生徒数を集計
	districtData.features.forEach((district) => {
		// 年度付きの人数取得ヘルパー関数をループ内に定義
		const getYearCounts = (
			p: GeoJSONData["features"][number]["properties"],
			y: number,
			modeKey: "Name_1" | "Name_2",
		) => {
			const yearKey = modeKey === "Name_1" ? `num_sho${y}` : `num_chu${y}`
			const editedKey = modeKey === "Name_1" ? "num_sho" : "num_chu"
			const fallbackKey = modeKey === "Name_1" ? "num_sho2024" : "num_chu2024"

			let value = 0
			let source = "default"
			let availableKeys: string[] = []

			if (p) {
				availableKeys = Object.keys(p).filter(
					(key) => key.includes("num_sho") || key.includes("num_chu") || key === "editedStudents",
				)
			}

			// 1. editedStudents のデータを最優先（人口倍率や手動編集の反映値）
			if (p?.editedStudents?.[editedKey] !== undefined && p.editedStudents[editedKey] !== null) {
				value = Number(p.editedStudents[editedKey]) || 0
				source = `編集済みデータ(${editedKey})`
			}
			// 2. 指定年度の生データ
			else if (p?.[yearKey] !== undefined && p[yearKey] !== null) {
				value = Number(p[yearKey]) || 0
				source = `年度別データ(${yearKey})`
			}
			// 3. 2024年度データをフォールバック
			else if (p?.[fallbackKey] !== undefined && p[fallbackKey] !== null) {
				value = Number(p[fallbackKey]) || 0
				source = `フォールバック2024年(${fallbackKey})`
			}

			if (debugCount < maxDebugLogs && displayMode === "original") {
				console.log(` 地区${district.properties.id} 年度参照詳細:`, {
				選択年度: y,
				モード: modeKey === "Name_1" ? "小学校" : "中学校",
				検索キー: yearKey,
				取得値: value,
				データソース: source,
				利用可能キー: availableKeys,
				生データ: {
					[yearKey]: p?.[yearKey],
					editedStudents: p?.editedStudents,
					[fallbackKey]: p?.[fallbackKey],
				},
				})
			}

			return value
		}

		const schoolName = resolveSchoolName(district)

		const numStudents = getYearCounts(district.properties, resolvedYear, mode)

		if (debugCount < maxDebugLogs && displayMode === "original") {
			console.log(` 既存校区割り当て: 地区${district.properties.id} → 学校${schoolName} (${numStudents}人)`)
			debugCount++
		}

		const school = schoolData.features.find((s) => s.properties.name === schoolName)
		const shouldAddStudents = displayMode === "original" || !school?.properties.isClosed

		if (school && numStudents && shouldAddStudents) {
			if (mode === "Name_1") {
				school.properties.assignedStudentsSho = (school.properties.assignedStudentsSho || 0) + numStudents
			} else {
				school.properties.assignedStudentsChu = (school.properties.assignedStudentsChu || 0) + numStudents
			}
		}
	})

	if (displayMode === "original") {
		const modeLabel = mode === "Name_1" ? "小学校" : "中学校"
		const studentKey = mode === "Name_1" ? "assignedStudentsSho" : "assignedStudentsChu"
		const totalStudents = schoolData.features.reduce((sum, school) => {
			return sum + (school.properties[studentKey] || 0)
		}, 0)

		console.log(` 既存校区モード最終結果:`, {
			年度: resolvedYear,
			モード: modeLabel,
			総生徒数: totalStudents,
			学校別内訳: schoolData.features
				.filter((school) => (school.properties[studentKey] || 0) > 0)
				.map((school) => ({
					学校名: school.properties.name,
					生徒数: school.properties[studentKey],
				})),
		})
	}

	if (displayMode !== "original") {
		schoolData.features.forEach((school) => {
			const props = school.properties ?? {}
			const assignedSho = Number(props.assignedStudentsSho ?? 0)
			const assignedChu = Number(props.assignedStudentsChu ?? 0)
			const category = getSchoolCategory(props.name)

			const shouldEvaluateClosure =
				(mode === "Name_1" && category === "elementary") ||
				(mode === "Name_2" && category === "middle") ||
				(category === "other" && mode === "Name_2")

			if (!shouldEvaluateClosure) {
				return
			}

			evaluateClosureState(props, assignedSho, assignedChu, { forceAutoClosure })
		})
	}
}

type DistrictOptionEntry = { Name_1: DistrictOptionValue; Name_2: DistrictOptionValue }

export const saveGeoJSON = (
	districtData: GeoJSONData | null,
	schoolData: SchoolGeoJSONData | null,
	options?: {
		districtOptions?: Record<string, DistrictOptionEntry>
		selectedMode?: "Name_1" | "Name_2"
		displayMode?: DisplayMode
	},
) => {
	if (!districtData || !schoolData) return

	const selectedMode = options?.selectedMode ?? "Name_1"
	const displayMode = options?.displayMode ?? "current"

	const resolveDistrictName = (feature: GeoJSONData["features"][number], mode: "Name_1" | "Name_2") => {
		const props = feature?.properties ?? {}
		const baseName = props[mode]

		if (displayMode === "original") {
			return props.originalDistricts?.[mode] ?? baseName
		}
		if (displayMode === "optimized") {
			return props.optimizedDistricts?.[mode] ?? props.editedDistricts?.[mode] ?? baseName
		}
		return props.editedDistricts?.[mode] ?? baseName
	}

	const updatedDistrictData = {
		...districtData,
		features: districtData.features.map((feature) => ({
			...feature,
			properties: {
				...feature.properties,
				Name_1: resolveDistrictName(feature, "Name_1"),
				Name_2: resolveDistrictName(feature, "Name_2"),
				districtOptions:
					options?.districtOptions?.[feature.properties?.id] ??
					feature.properties?.districtOptions,
				districtOption:
					(options?.districtOptions?.[feature.properties?.id] ??
						feature.properties?.districtOptions)?.[selectedMode] ??
					feature.properties?.districtOption,
			},
		})),
	}

	const updatedSchoolData = {
		...schoolData,
		features: schoolData.features.map((school) => ({
		...school,
		properties: {
			...school.properties,
		},
		})),
	}

	const exportData = {
		districts: updatedDistrictData,
		schools: updatedSchoolData,
	}

	const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
	const timestamp = getTimestamp()
	const a = document.createElement("a")
	a.href = URL.createObjectURL(blob)
	a.download = `edited_merged_${timestamp}.geojson`
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
}

export const exportSchoolsToCSV = (
  districtData: GeoJSONData | null,
  schoolData: SchoolGeoJSONData | null,
  selectedMode: "Name_1" | "Name_2",
	displayMode: DisplayMode,
) => {
  if (!districtData || !schoolData) return;

  const resolveSchoolName = (district: GeoJSONData["features"][number]) => {
    const props = district?.properties ?? {}
    const baseName = props[selectedMode]

    if (displayMode === "original") {
      return props.originalDistricts?.[selectedMode] ?? baseName
    }
    if (displayMode === "current") {
      return props.editedDistricts?.[selectedMode] ?? baseName
    }
    if (displayMode === "optimized") {
      return props.optimizedDistricts?.[selectedMode] ?? props.editedDistricts?.[selectedMode] ?? baseName
    }
    return props.editedDistricts?.[selectedMode] ?? baseName
  };

  const summary: Record<string, {
    minStudents: number | string;
    maxStudents: number | string;
    assignedStudentsSho: number;
    assignedStudentsChu: number;
    districts: string[];
    isClosed: boolean;
  }> = {};

  schoolData.features.forEach((s) => {
    summary[s.properties.name] = {
      minStudents: s.properties.min_students ?? "不明",
      maxStudents: s.properties.max_students ?? "不明",
      assignedStudentsSho: s.properties.assignedStudentsSho ?? 0,
      assignedStudentsChu: s.properties.assignedStudentsChu ?? 0,
      districts: [],
      isClosed: s.properties.isClosed ?? false,
    };
  });

  districtData.features.forEach((d) => {
    const name = resolveSchoolName(d);
    if (name && summary[name]) summary[name].districts.push(d.properties.id);
  });

  const headers = ["学校名","適正規模(最小)","適正規模(最大)","割当児童数","割当生徒数","割当地区数","地区IDリスト","廃校"];
  const rows = Object.entries(summary).map(([name, v]) => [
    name, v.minStudents, v.maxStudents, v.assignedStudentsSho, v.assignedStudentsChu,
    v.districts.length, v.districts.join(","), v.isClosed ? "TRUE" : "FALSE",
  ]);

  const BOM = "\uFEFF";
  const csv = BOM + [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `school_summary_${getTimestamp()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// === 新規: 地区別割当（縦=町丁目、1行に小/中） ===
export const exportDistrictsToCSV = (
  districtData: GeoJSONData | null,
  displayMode: DisplayMode,
  selectedYear: number, // 年度はファイル名に入れるだけ（列に不要なら参照しない）
) => {
  if (!districtData) return;

  const headers = ["町丁目ID","町丁目名","割当小学校","割当中学校"];
  const pick = (p: GeoJSONData["features"][number]["properties"], mode: "Name_1"|"Name_2") => {
    if (displayMode === "original") return p.originalDistricts?.[mode] ?? p[mode] ?? "";
    if (displayMode === "optimized") return p.optimizedDistricts?.[mode] ?? p.editedDistricts?.[mode] ?? p[mode] ?? "";
    // current/その他
    return p.editedDistricts?.[mode] ?? p[mode] ?? "";
  };

  const rows = districtData.features.map((f) => {
    const p = f.properties;
    return [String(p.id ?? ""), String(p.name ?? ""), String(pick(p,"Name_1")), String(pick(p,"Name_2"))];
  });

  const BOM = "\uFEFF";
  const csv = BOM + [headers, ...rows]
    .map(r => r.map(c => {
      const s = String(c);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `学区割当_${selectedYear}年度_${displayMode}_${getTimestamp()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// 最適化結果を「現在の割り当て（edited）」に反映し、学校の集計と廃校フラグを更新
export function applyOptimizedToCurrent(
  districtData: GeoJSONData | null,
  schoolData: SchoolGeoJSONData | null,
) {
  if (!districtData?.features || !schoolData?.features) return;

  // 1) optimizedDistricts -> editedDistricts へコピー
  districtData.features.forEach((f: GeoJSONData["features"][number]) => {
    const opt = f?.properties?.optimizedDistricts;
    if (!opt) return;

    if (!f.properties.editedDistricts) f.properties.editedDistricts = {};
    if (opt.Name_1) f.properties.editedDistricts.Name_1 = opt.Name_1;
    if (opt.Name_2) f.properties.editedDistricts.Name_2 = opt.Name_2;
  });

  // 2) 学校ごとの担当児童/生徒数を再集計
  const counts: Record<string, { sho: number; chu: number }> = {};
  schoolData.features.forEach((s: SchoolGeoJSONData["features"][number]) => {
    counts[s.properties.name] = { sho: 0, chu: 0 };
  });

  districtData.features.forEach((f: GeoJSONData["features"][number]) => {
    const ed = f?.properties?.editedDistricts || {};
    // 町丁目の人数（編集後があれば優先）
    const numSho = f?.properties?.editedStudents?.num_sho ?? f?.properties?.num_sho2024 ?? 0;
    const numChu = f?.properties?.editedStudents?.num_chu ?? f?.properties?.num_chu2024 ?? 0;

    const sho = ed.Name_1;
    const chu = ed.Name_2;

    if (sho && counts[sho]) counts[sho].sho += Number(numSho) || 0;
    if (chu && counts[chu]) counts[chu].chu += Number(numChu) || 0;
  });

  // 3) 学校側の人数・廃校フラグを上書き
  schoolData.features.forEach((s: SchoolGeoJSONData["features"][number]) => {
    const name = s.properties.name;
    const c = counts[name] ?? { sho: 0, chu: 0 };
    s.properties.assignedStudentsSho = c.sho;
    s.properties.assignedStudentsChu = c.chu;

    evaluateClosureState(
      s.properties,
      Number(c.sho) || 0,
      Number(c.chu) || 0,
      { forceAutoClosure: true },
    );
  });
}
