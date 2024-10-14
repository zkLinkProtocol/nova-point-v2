const fs = require("fs");
const csv = require("fast-csv");

// 定义异步函数以获取数据
async function fetchUserAddresses() {
  const url = "http://localhost:4006/points/puffer?page=1&limit=30000";

  try {
    const response = await fetch(url);
    const data = await response.json();

    // 确保返回的数据结构是正确的
    const users = data.data?.list.sort((a,b)=> b.pufferPoints - a.pufferPoints).map(i=>({...i, percentage: i.pufferPoints/data.data.totalPufferPoints}))
    // .filter(i=> ![
    //   '0xe143694271a0b34ea6c7928d9b66d31f60b2bfed',
    //   '0x4ac97e2727b0e92ae32f5796b97b7f98dc47f059',
    //   '0xc48f99afe872c2541f530c6c87e3a6427e0c40d5',
    //   '0x9f748e05258abb839008192310b0341fee05fea0',
    //   '0xdd6105865380984716c6b2a1591f9643e6ed1c48',
    //   '0x59d9ceaf0108a5af76336cad0ec7c7c5c266eb39',
    // ].includes(i.userAddress)) || []; // 假设 `list` 包含用户信息

    const totalPercent = users.reduce((acc, cur)=> {
      return acc+ Number(cur.percentage)
    },0)
    console.log('total percent:',totalPercent)
    if (users.length === 0) {
      console.log("没有找到用户数据");
      return;
    }

    const totalPufferPoints = users.reduce((sum, user) => {
      return sum + parseFloat(user.pufferPoints);
    }, 0);

    console.log(`Return: ${data.data?.totalPufferPoints}, Total Puffer Points: ${totalPufferPoints.toFixed(6)}`);

    // 打开一个写入流来创建 CSV 文件
    const ws = fs.createWriteStream("puffer_points_v3.csv");

    // 使用 fast-csv 写入 CSV 文件
    csv
      .write(
        users.map((user) => [user.userAddress, user.percentage]),
        { headers: ["address", "percentage"] },
      )
      .pipe(ws)
      .on("finish", () => {
        console.log("CSV 文件已成功生成！");
      });
  } catch (error) {
    console.error("获取数据时出错:", error);
  }
}

// 调用函数
fetchUserAddresses();
