+++
title = 'power'
data = 2024-09-20
draft = true
+++
# introduction
损耗计算公式
$$ P_\mathrm{L}(\mathrm{on})=\delta I_\mathrm{F}V_\mathrm{F} $$
[power dissation](picture/损耗.png)

饱和区漏极电流与栅极电压的关系
$$ I_{D,sat}\propto(V_{GS}-V_{th})^2 $$
由于饱和区收到沟道宽度调制影响，不仅收栅极电压还受到漏源电压$V_{DS}$ 的影响，所有削弱平方关系，使漏电流线性增长。

双极性在工作时，少数载流子在起作用。其由三个部分构成，发射区（emmiter），基区（Base)和集电区（collector),NPN型晶体管工作时，发射极基极正偏，发射区多数载流子进入基区，成为基区中的少数载流子，紧接着在基区扩散到集电区中，由于基区很薄不会复合。基极集电极反偏，少数载流子迅速被集电区收集形成电流。  
当其切换到阻断状态时时必须把少数载流子移除，主要通过门极驱动电流和空穴电子对复合，在此过程造成大量的功率损耗，降低效率。  
因此倾向于单极性器件，典型的是肖特基整流管，通过金属半导体界面对电流进行整流。通常肖特基i二极管的阻断电压只能到100V超过后会增大导通压降，但SiC肖特基二极管可以实现高的击穿电压和低的导通压降，低的漂移区电阻，优秀的开关特性。
![schottky](picture/Schottky-rectifier-structure.png)
u-mosfet即垂直型mosfet通过消除jfet区减少电阻  
GTO以及双极性晶体管需要很大的电流驱动以及减震电路来减少暂态过电压过大。于是提出mos双极性结构IGBT。
![GTO](picture/GTO.png)
![UMOS-IGBT](picture/UMOS-IGBT.png)
具有四层晶闸管
mos-control-thyristor
![MCT](picture/MCT.png)
通过使四层晶闸管结构闭锁实现较低的导通压降。通过给mos的栅极施加正电压，激发mosfet导通，使阳极和阴极之间产生电流，启动晶闸管的自保留模式，晶闸管的少数载流子注入机制使电流迅速增大，从而保持导通状态，MCT进入低导通电阻状态。通过关闭晶闸管的正反馈效应来关闭MCT，栅极施加负电压驱动另一个MOSFET，使其在\(N_+\)发射极和p基区之间形成一个电流分流通道，这个通道使载流子流向栅极，减少关键PN结处的载流子流动，降低了NPN晶体管的电流增益，切断晶闸管的少数载流子流动，PNPN结构中的少数载流子被迅速抽出，使晶闸管失去正反馈效应，终止导通状态，晶闸管转换为高阻状态，MCT进入关断状态。
提出基极电阻控制晶闸管：BRT分流区相邻四层晶闸管结构
![BRT](picture/BRT.png)

### 1.6
理想的drift区域假设为两边的惨杂浓度都是一致的，忽略结的曲率影响。泊松方程解出电场按三角形分布，其中单位面积电阻为
$$ R_\mathrm{on.sp}=\left(\frac{W_\mathrm{D}}{q\mu_\mathrm{n}N_\mathrm{D}}\right) $$
耗尽层宽度depletion width 
$$ W_\mathrm{D}=\frac{2BV}{E_\mathrm{C}} $$
达到目标耐压需要的惨杂浓度
$$N_\mathrm{D}=\frac{\varepsilon_\mathrm{S}{E_{\mathrm{C}}^{2}}}{2qBV}$$
结合后理想漂移区的单位面积电阻
$$ R_{\mathrm{on-ideal}}=\frac{4BV^{2}}{\varepsilon_{S}\mu_\mathrm{n}E_\mathrm{C}^{3}}$$

GaAs由于电子迁移率高，而SiC由于禁带宽度大导致两者的导通电阻很小。
### 1.7
临界击穿电压下的电荷密度公式
$$ Q_\mathrm{optimum}=2qN_\mathrm{D}W_\mathrm{N}=\epsilon_\mathrm{S}E_\mathrm{C} $$
在电荷耦合结构下的导通电阻：
$$ R_\mathrm{D,sp}=\rho_\mathrm{D}\left(\frac{p}{W_\mathrm{N}}\right)t $$
结合电阻率与惨杂浓度的关系
$$ \rho=\frac{1}{q\cdot(n\cdot\mu_\mathrm{n}+p\cdot\mu_\mathrm{p})}$$
得到
$$ R_\mathrm{D,sp}=\frac{tp}{q\mu_\mathrm{N}N_\mathrm{D}W_\mathrm{N}}$$
结合临界电荷得
$$ R_\mathrm{D,sp}=\frac{2tp}{\mu_\mathrm{N}Q_\mathrm{optimum}}$$