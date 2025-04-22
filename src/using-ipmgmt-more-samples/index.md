---
title: 'How to automate IP ranges calculations in Azure using PowerShell'
date: 2023-10-01T18:39:14-07:00
section: PowerShell
---

Suppose we have been allocated the IP range of `10.172.0.0/16` by the network team for planned Azure Landing Zones. The goal is to automate this by creating a tool that will automatically calculate IP ranges for us, based on some high-level and easy-to-understand details regarding the future networks.

This notebook demonstrates how to achieve this using the [ipmgmt](https://github.com/eosfor/ipmgmt) module.
<!--more-->


Let's start by installing it:

```powershell
Install-Module ipmgmt -Scope CurrentUser
```

And now, we'll import it:

```powershell
Import-Module ipmgmt
```

The `ipmgmt` module comprises only two cmdlets. The `Get-VLSMBreakdown` cmdlet breaks down a range into smaller ones, making it possible to segment a range into VNETs and then each VNET into subnets. The `Get-IPRanges` cmdlet, given a list of in-use ranges and a "root" range, attempts to find a free slot of the specified size, which can be handy to prevent IP space wastage.

```powershell
Get-Command -Module ipmgmt
```

```console
CommandType     Name                                               Version    Source
-----------     ----                                               -------    ------
Function        Get-IPRanges                                       0.1.5      ipmgmt
Function        Get-VLSMBreakdown                                  0.1.5      ipmgmt
```

Let's breakdown our large "root" IP range into smaller ones. To do this, we need to prepare a list of smaller sub-ranges in the form of PowerShell hashtables, like so: `@{type = "VNET-HUB"; size = (256-2)}`. Here, we specify that the name of the range is `VNET-HUB`, and the size is `256-2`, which is the maximum number of IPs in a `/24` subnet, minus 2 for the first and the last IP.

If more than one subnet is required, we create an array of these hashtables:

```powershell
$subnets = @{type = "VNET-HUB"; size = (256-2)},
           @{type = "VNET-A"; size = (256-2)}
```

Now we can attempt to break down the "root" network:

```powershell
Get-VLSMBreakdown -Network 10.172.0.0/16 -SubnetSize $subnets | ft type, network, netmask, *usable, cidr -AutoSize
```

```console
type     Network      Netmask       FirstUsable  LastUsable     Usable Cidr
----     -------      -------       -----------  ----------     ------ ----
VNET-A   10.172.1.0   255.255.255.0 10.172.1.1   10.172.1.254      254   24
VNET-HUB 10.172.0.0   255.255.255.0 10.172.0.1   10.172.0.254      254   24
reserved 10.172.128.0 255.255.128.0 10.172.128.1 10.172.255.254  32766   17
reserved 10.172.64.0  255.255.192.0 10.172.64.1  10.172.127.254  16382   18
reserved 10.172.32.0  255.255.224.0 10.172.32.1  10.172.63.254    8190   19
reserved 10.172.16.0  255.255.240.0 10.172.16.1  10.172.31.254    4094   20
reserved 10.172.8.0   255.255.248.0 10.172.8.1   10.172.15.254    2046   21
reserved 10.172.4.0   255.255.252.0 10.172.4.1   10.172.7.254     1022   22
reserved 10.172.2.0   255.255.254.0 10.172.2.1   10.172.3.254      510   23
```

Here, we obtained two ranges named `VNET-A` and `VNET-HUB`. However, by doing so, we generated some unused slots in the `root` range. These are marked as `reserved` for convenience, illustrating what happens to the range when it's broken down. The smaller the sub-ranges you create, the more of such unused ranges you'll have in the end.

We can also achieve this using CIDR notation:

```powershell
$subnets = @{type = "GTWSUBNET"; cidr = 27},
@{type = "DMZSUBNET"; cidr = 26},
@{type = "EDGSUBNET"; cidr = 27},
@{type = "APPSUBNET"; cidr = 26},
@{type = "CRESUBNET"; cidr = 26}

Get-VLSMBreakdown -Network 10.10.5.0/24 -SubnetSizeCidr $subnets | ft -AutoSize
```

```console
type      Network     AddressFamily Netmask         Broadcast   FirstUsable LastUsable  Usable Total
----      -------     ------------- -------         ---------   ----------- ----------  ------ -----
EDGSUBNET 10.10.5.224  InterNetwork 255.255.255.224 10.10.5.255 10.10.5.225 10.10.5.254     30   32
GTWSUBNET 10.10.5.192  InterNetwork 255.255.255.224 10.10.5.223 10.10.5.193 10.10.5.222     30   32
CRESUBNET 10.10.5.128  InterNetwork 255.255.255.192 10.10.5.191 10.10.5.129 10.10.5.190     62   64
APPSUBNET 10.10.5.64   InterNetwork 255.255.255.192 10.10.5.127 10.10.5.65  10.10.5.126     62   64
DMZSUBNET 10.10.5.0    InterNetwork 255.255.255.192 10.10.5.63  10.10.5.1   10.10.5.62      62   64
```

Now, let's try to use what we have. To do that, we need to authenticate to Azure. When running locally, you can simply do:

```powershell
Login-AzAccount
```

However, in Binder, it needs to be slightly different, like so:

```powershell
Connect-AzAccount -UseDeviceAuthentication
```

Once authenticated, we can create networks, for example, like this. Here we first filter out the `reserved` ones for simplicity.

```powershell
$vnets = Get-VLSMBreakdown -Network 10.172.0.0/16 -SubnetSize $subnets | ? type -ne 'reserved'

$vnets | % {
    New-AzVirtualNetwork -Name  $_.type -ResourceGroupName 'vnet-test' `
                         -Location 'eastus2' -AddressPrefix "$($_.Network)/$($_.cidr)" | select name, AddressSpace, ResourceGroupName, Location
}
```

Now, assume at some point we need to add a few more networks. Simultaneously, we might want to reuse one of the `reserved` slots if it matches the size. This is what `Get-IPRanges` does. It takes a list of IP ranges "in-use" and returns slots that can fit the range in question. For instance, in our case, we have a "base range" of `10.10.0.0/16` and two ranges in-use `10.10.5.0/24`, `10.10.7.0/24`. We are looking for a range of size `/22`. So, the cmdlet recommends us to use the `10.172.4.0/22`, which is one of the `reserved` ranges from the previous example.

```powershell
Get-IPRanges -Networks "10.172.1.0/24", "10.172.0.0/24" -CIDR 22 -BaseNet "10.172.0.0/16" | ft -AutoSize
```

```console
IsFree Network    AddressFamily Netmask       Broadcast    FirstUsable LastUsable   Usable Total Cidr
------ -------    ------------- -------       ---------    ----------- ----------   ------ ----- --
False  10.172.0.0  InterNetwork 255.255.255.0 10.172.0.255 10.172.0.1  10.172.0.254    254   256 24
False  10.172.1.0  InterNetwork 255.255.255.0 10.172.1.255 10.172.1.1  10.172.1.254    254   256 24
True   10.172.4.0  InterNetwork 255.255.252.0 10.172.7.255 10.172.4.1  10.172.7.254   1022  1024 22
```

What if we need to find more than just one range at a time? No worries. We can accomplish this with the following script. Here, we are using Azure as the source of truth, as it allows us to always query it for the real IP ranges that are in use.

So, the steps to achieve this are quite straightforward:

1. Create a list of sizes we want to create and store it in a variable - `$cidrRange`.
2. Pull the ranges from Azure, assuming they are in use by someone - `$existingRanges`.
3. Cast whatever we pulled from Azure to `System.Net.IPNetwork` for correctness. This type is used inside the `ipmgmt` module to store information about networks and perform all the calculations, comparisons, etc.
4. Now we run through the list of sizes, for each of them ask `Get-IPRanges` to find a proper slot, and accumulate the results.

Now, we just need to mark the new ranges as `free`, to see what we've got. For that, we compare what we have in Azure to what we just calculated, and mark the difference accordingly.

```powershell
$cidrRange = 25,25,24,24,24,24,23,25,26,26 | sort
$existingRanges = (Get-AzVirtualNetwork -ResourceGroupName vnet-test | 
    select name, @{l = "AddressSpace"; e = { $_.AddressSpace.AddressPrefixes }}, ResourceGroupName, Location |
    select -expand AddressSpace)
$existingNetworks = $existingRanges | % {[System.Net.IPNetwork]$_}
$nets = $existingRanges

$ret = @()

$cidrRange | % {
    $ret = Get-IPRanges -Networks $nets -CIDR $_ -BaseNet "10.172.0.0/16"
    $nets = ($ret | select @{l="range"; e = {"$($_.network)/$($_.cidr)"}}).range
}

$ret | % {
    if ( -not ($_ -in $existingNetworks)) {$_.IsFree = $true}
}

$ret | ft -AutoSize
```

```console
IsFree Network      AddressFamily Netmask         Broadcast    FirstUsable  LastUsable   Usable Total
------ -------      ------------- -------         ---------    -----------  ----------   ------ ---
False 10.172.0.0    InterNetwork 255.255.255.0   10.172.0.255 10.172.0.1   10.172.0.254    254 256
False 10.172.1.0    InterNetwork 255.255.255.0   10.172.1.255 10.172.1.1   10.172.1.254    254 256
True  10.172.2.0    InterNetwork 255.255.254.0   10.172.3.255 10.172.2.1   10.172.3.254    510 512
True  10.172.4.0    InterNetwork 255.255.255.0   10.172.4.255 10.172.4.1   10.172.4.254    254 256
True  10.172.5.0    InterNetwork 255.255.255.0   10.172.5.255 10.172.5.1   10.172.5.254    254 256
True  10.172.6.0    InterNetwork 255.255.255.0   10.172.6.255 10.172.6.1   10.172.6.254    254 256
True  10.172.7.0    InterNetwork 255.255.255.0   10.172.7.255 10.172.7.1   10.172.7.254    254 256
True  10.172.8.0    InterNetwork 255.255.255.128 10.172.8.127 10.172.8.1   10.172.8.126    126 128
True  10.172.8.128  InterNetwork 255.255.255.128 10.172.8.255 10.172.8.129 10.172.8.254    126 128
True  10.172.9.0    InterNetwork 255.255.255.128 10.172.9.127 10.172.9.1   10.172.9.126    126 128
True  10.172.9.128  InterNetwork 255.255.255.192 10.172.9.191 10.172.9.129 10.172.9.190     62  64
True  10.172.9.192  InterNetwork 255.255.255.192 10.172.9.255 10.172.9.193 10.172.9.254     62  64
```

This provides us with all the necessary information to add a few more networks to our Azure environment.