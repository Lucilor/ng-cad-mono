export const calc = (data, 切口损耗) => {
    const bomGroups = {};
    for (const bom of data.型材BOM) {
        const key = bom.型材优化分组信息;
        if (!bomGroups[key]) {
            bomGroups[key] = [];
        }
        bomGroups[key].push(bom);
    }
    const map余料 = {};
    for (const item of data.铝型材余料库存) {
        map余料[item.vid] = Object.assign({}, item);
    }
    const resultItems = [];
    const usedBoms = new Set();
    const backpackDp = (boms, totalLength, num) => {
        const result = [];
        if (boms.length < 1) {
            return result;
        }
        const getDpItemValue = (dpItem) => {
            return dpItem.value - dpItem.cuts;
        };
        while (boms.length > 0 && num > 0) {
            let dp = [];
            for (const [i, bom] of boms.entries()) {
                const length = parseFloat(bom.型材长度);
                if (i === 0) {
                    dp.push([0, { value: 0, items: [], cuts: 0 }]);
                    if (length <= totalLength) {
                        const dpItem = [length, { value: length, items: [bom], cuts: 0 }];
                        if (length < totalLength) {
                            dpItem[0] = Math.min(totalLength, dpItem[0] + 切口损耗);
                            dpItem[1].cuts++;
                        }
                        dp.push(dpItem);
                    }
                }
                else {
                    const dp2 = dp.slice();
                    for (const dpItem of dp) {
                        const unusedLength = totalLength - dpItem[0];
                        if (dpItem[1].items.find((v) => v.vid === bom.vid)) {
                            continue;
                        }
                        if (length <= unusedLength) {
                            const [length2, item] = dpItem;
                            const dpItem2 = [
                                length2 + length,
                                {
                                    value: item.value + length,
                                    items: [...item.items, bom],
                                    cuts: item.cuts
                                }
                            ];
                            if (length < unusedLength) {
                                dpItem2[0] = Math.min(totalLength, dpItem2[0] + 切口损耗);
                                dpItem2[1].cuts++;
                            }
                            let shouldAdd = true;
                            for (const v of dp) {
                                const val1 = getDpItemValue(v[1]);
                                const val2 = getDpItemValue(dpItem2[1]);
                                if (v[0] === dpItem2[0] && val1 < val2) {
                                    shouldAdd = false;
                                    v[1] = dpItem2[1];
                                    break;
                                }
                                if (v[0] <= dpItem2[0] && val1 >= val2) {
                                    shouldAdd = false;
                                    break;
                                }
                            }
                            if (shouldAdd) {
                                dp2.push(dpItem2);
                            }
                            else {
                                // console.log(dp2[i - 1].slice(), dpItem2);
                            }
                        }
                    }
                    dp = dp2;
                }
            }
            let max = 0;
            let maxIndex = -1;
            for (const [i, dpItem] of dp.entries()) {
                const val = getDpItemValue(dpItem[1]);
                if (val >= max) {
                    max = val;
                    maxIndex = i;
                }
            }
            const resultItem = dp[maxIndex][1];
            if (resultItem.value === 0) {
                continue;
            }
            result.push(resultItem);
            for (const item of resultItem.items) {
                usedBoms.add(item.vid);
            }
            const length = boms.length;
            boms = boms.filter((v) => !usedBoms.has(v.vid));
            num--;
            if (length === boms.length) {
                break;
            }
        }
        return result;
    };
    // const
    for (const 余料 of data.铝型材余料库存) {
        const boms = data.型材BOM.filter((v) => v.铝型材 === 余料.lvxingcai && v.型材颜色 === 余料.yanse && !usedBoms.has(v.vid));
        if (boms.length < 1) {
            continue;
        }
        const totalLength = 余料.yuliaochangdu;
        const dpResult = backpackDp(boms, totalLength, 余料.kucunshuliang);
        for (const dpItem of dpResult) {
            const usedLength = dpItem.value;
            const wastedLength = Math.min(totalLength - usedLength, dpItem.cuts * 切口损耗);
            resultItems.push({
                vid: 余料.vid,
                铝型材: 余料.lvxingcai,
                物料长度: totalLength,
                物料颜色: boms[0].型材颜色,
                数量: 1,
                单支型材利用率: 0,
                排料后剩余长度: totalLength - usedLength - wastedLength,
                切口损耗: wastedLength,
                BOM: dpItem.items,
                废料长度: totalLength - usedLength - wastedLength,
                余料可以入库: wastedLength >= 余料.yuliaorukuzuixiaochangdu,
                余料标签信息: "",
                型材类型: "余料"
            });
        }
    }
    for (const 铝型材 of data.铝型材) {
        const boms = data.型材BOM.filter((v) => v.铝型材 === 铝型材.mingzi && !usedBoms.has(v.vid));
        if (boms.length < 1) {
            continue;
        }
        const totalLength = 铝型材.biaozhunchangdu;
        const dpResult = backpackDp(boms, totalLength, Infinity);
        for (const dpItem of dpResult) {
            const usedLength = dpItem.value;
            const wastedLength = Math.min(totalLength - usedLength, dpItem.cuts * 切口损耗);
            resultItems.push({
                vid: 铝型材.vid,
                铝型材: 铝型材.mingzi,
                物料长度: totalLength,
                物料颜色: boms[0].型材颜色,
                数量: 1,
                单支型材利用率: 0,
                排料后剩余长度: totalLength - usedLength - wastedLength,
                切口损耗: wastedLength,
                BOM: dpItem.items,
                型材类型: "标准型材"
            });
        }
    }
    const result = [];
    for (const item of resultItems) {
        const group = result.find((v) => v.型材 === item.铝型材 && v.颜色 === item.物料颜色);
        if (group) {
            group.优化结果.push(item);
        }
        else {
            result.push({
                型材: item.铝型材,
                颜色: item.物料颜色,
                所有型材利用率: 0,
                优化结果: [item]
            });
        }
    }
    let totalLength = 0;
    let unusedLength = 0;
    for (const resultItem of result) {
        let totalLength2 = 0;
        let unusedLength2 = 0;
        for (const item of resultItem.优化结果) {
            totalLength2 += item.物料长度;
            const unusedLength3 = item.排料后剩余长度;
            unusedLength2 += unusedLength3;
            item.排料后剩余长度 = getNum(item.排料后剩余长度);
            item.单支型材利用率 = getNum(1 - unusedLength3 / item.物料长度);
        }
        resultItem.所有型材利用率 = getNum(1 - unusedLength2 / totalLength2);
        totalLength += totalLength2;
        unusedLength += unusedLength2;
    }
    return { 铝型材优化结果: result, 总利用率: getNum(1 - unusedLength / totalLength) };
};
export const getNum = (num) => Number(num.toFixed(3));
